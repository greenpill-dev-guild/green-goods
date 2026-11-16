#!/usr/bin/env node
// Holds solhint's warnings on the contract sources to a shrink-only baseline: per rule and file, a
// count may go down, never up. Errors fail as solhint reports them, parse errors included. A count
// below its baseline fails in a file the change touches until `--baseline-shrink` records it, and
// the baseline itself may not grow over the base branch's copy, the same rules as the React-pattern
// baseline. The deployed sources stay as they are: the baseline stops new warnings without asking
// anyone to edit them. Growth needs the owner: a solhint upgrade that adds warnings, a revert of a
// fix, or a move git does not see as a rename fails the growth check until an admin merges a
// reviewed baseline.
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractsRoot = path.join(repoRoot, "packages/contracts");
export const BASELINE_PATH = "scripts/data/solhint-baseline.json";
const SOURCES = "packages/contracts/src";
// The lint step's own arguments, so this check sees what `lint` reports. `--disc` skips the update
// check, whose notice would land on stdout ahead of the JSON.
const SOLHINT_ARGS = ["--config", "./.solhint.json", "src/**/*.sol", "--ignore-path", ".solhintignore", "-f", "json", "--disc"];
const SHRINK_FLAG = "--baseline-shrink";
// The lint step runs in packages/contracts, so the advice says where the command runs.
const SHRINK_COMMAND = `node scripts/contracts/check-solhint-baseline.mjs ${SHRINK_FLAG}`;
const NOTE =
  "Shrink-only: per rule and file, the solhint warnings the contract sources still carry. Counts may go down, never up; record a lower count with `node scripts/contracts/check-solhint-baseline.mjs --baseline-shrink`.";

/**
 * Solhint's JSON report as its errors and warnings. A parse error is an error that names no rule;
 * the closing summary entry names no file.
 */
export function parseSolhintReport(text) {
  const entries = JSON.parse(text);
  if (!Array.isArray(entries)) throw new Error("solhint did not print a JSON list");
  const messages = entries.filter((entry) => entry?.filePath);
  return {
    errors: messages.filter((message) => message.severity === "Error"),
    warnings: messages.filter((message) => message.severity === "Warning" && message.ruleId),
  };
}

function sortCounts(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((rule) => [rule, Object.fromEntries(Object.keys(counts[rule]).sort().map((file) => [file, counts[rule][file]]))]),
  );
}

function eachCount(counts, visit) {
  for (const [rule, files] of Object.entries(counts ?? {})) {
    for (const [file, count] of Object.entries(files)) visit(rule, file, count);
  }
}

const movedTo = (renames) => new Map([...renames].map(([to, from]) => [from, to]));

// Solhint names files from the contracts package; the baseline from the repository root.
const sourcePath = (filePath) => path.posix.join("packages/contracts", filePath.split(path.sep).join("/"));

/** Warnings per rule and file. */
export function countWarnings(warnings) {
  const counts = {};
  for (const warning of warnings) {
    const file = sourcePath(warning.filePath);
    counts[warning.ruleId] ??= {};
    counts[warning.ruleId][file] = (counts[warning.ruleId][file] ?? 0) + 1;
  }
  return sortCounts(counts);
}

/** The lines each rule fires on in each file, keyed as `JSON.stringify([rule, file])`, so a failure can name them. */
export function warningLines(warnings) {
  const lines = new Map();
  for (const warning of warnings) {
    const key = JSON.stringify([warning.ruleId, sourcePath(warning.filePath)]);
    lines.set(key, [...(lines.get(key) ?? []), warning.line]);
  }
  return lines;
}

/**
 * Counts above the baseline (grown, new files included) and below it (stale). `renames` maps a new
 * path to its old one: a renamed file grows nothing while it keeps its old count, but every
 * baseline entry is judged at its own path, so the old path's entry is stale until
 * `--baseline-shrink` moves it and the baseline never keeps a path that is gone.
 */
export function compareCounts(baseline, counts, renames = new Map()) {
  const grown = [];
  const stale = [];
  eachCount(counts, (rule, file, now) => {
    const was = baseline[rule]?.[file] ?? baseline[rule]?.[renames.get(file)] ?? 0;
    if (now > was) grown.push({ rule, file, was, now });
  });
  eachCount(baseline, (rule, file, was) => {
    const now = counts[rule]?.[file] ?? 0;
    if (now < was) stale.push({ rule, file, was, now });
  });
  return { grown, stale };
}

/** Baseline counts above the base branch's copy; nothing when the base has no baseline. */
export function baselineGrowth(baseline, previous, renames = new Map()) {
  if (!previous) return [];
  const grown = [];
  eachCount(baseline, (rule, file, now) => {
    const was = previous[rule]?.[file] ?? previous[rule]?.[renames.get(file)] ?? 0;
    if (now > was) grown.push({ rule, file, was, now });
  });
  return grown;
}

/** The baseline lowered to today's counts. Refuses while any count is above it. */
export function shrinkBaseline(baseline, counts, renames = new Map()) {
  const { grown } = compareCounts(baseline, counts, renames);
  if (grown.length) throw new Error(`refusing to shrink: ${grown.length} count(s) are above the baseline`);
  const targets = movedTo(renames);
  const next = {};
  eachCount(baseline, (rule, file, was) => {
    const target = targets.get(file) ?? file;
    const now = Math.min(was, counts[rule]?.[target] ?? 0);
    if (now > 0) (next[rule] ??= {})[target] = now;
  });
  return sortCounts(next);
}

/** The counts of a version 1 baseline. Throws on anything else. */
export function parseBaseline(source) {
  const document = JSON.parse(source);
  if (document?.version !== 1 || !document.counts || typeof document.counts !== "object" || Array.isArray(document.counts)) {
    throw new Error(`${BASELINE_PATH} is not a version 1 baseline`);
  }
  for (const [rule, files] of Object.entries(document.counts)) {
    if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error(`${BASELINE_PATH}: ${rule} is not an object of counts`);
    for (const [file, count] of Object.entries(files)) {
      if (!Number.isInteger(count) || count < 1) throw new Error(`${BASELINE_PATH}: ${rule} ${file}: ${JSON.stringify(count)} is not a positive whole number`);
    }
  }
  return document.counts;
}

export function formatBaseline(counts) {
  return `${JSON.stringify({ version: 1, note: NOTE, counts }, null, 2)}\n`;
}

/**
 * What fails, the lines that say so, and notes that do not fail. A stale count fails only in a file
 * the change touches (`changed`; every file when the base is unknown), so two shrinks that merge
 * together do not block every change. The trade-off: until someone records the lower count, that
 * file has room for as many new warnings as the stale entry allows, and only develop's own run
 * shows the stale entry. Pure, so every case can be tested.
 */
export function judge({ errors, counts, baseline, previous = null, renames = new Map(), changed = null, places = new Map() }) {
  const lines = errors.map((error) => `error ${error.filePath}:${error.line} ${error.ruleId ?? "parse"}: ${error.message}`);
  const notes = [];
  const { grown, stale } = compareCounts(baseline, counts, renames);
  for (const { rule, file, was, now } of grown) {
    const where = places.get(JSON.stringify([rule, file]));
    lines.push(`new warning in ${file}: ${rule} ${now}, the baseline allows ${was}${where ? ` (lines ${where.join(", ")})` : ""}`);
  }
  for (const { rule, file, was, now } of stale) {
    if (changed === null || changed.has(file)) lines.push(`stale baseline for ${file}: ${rule} ${now} left of ${was}; record it with \`${SHRINK_COMMAND}\` from the repository root`);
    else notes.push(`stale baseline for ${file}: ${rule} ${now} left of ${was}, in a file this change does not touch; \`${SHRINK_COMMAND}\` from the repository root records it`);
  }
  for (const { rule, file, was, now } of baselineGrowth(baseline, previous, renames)) {
    lines.push(`baseline grew for ${file}: ${rule} ${was} on the base, ${now} here`);
  }
  return { ok: lines.length === 0, lines, notes };
}

// Solhint exits before a pipe drains, so a piped report stops at 64 KiB; a file keeps all of it.
function runSolhint() {
  const folder = mkdtempSync(path.join(tmpdir(), "solhint-report-"));
  const reportPath = path.join(folder, "report.json");
  const output = openSync(reportPath, "w");
  try {
    const result = spawnSync(process.execPath, ["node_modules/solhint/solhint.js", ...SOLHINT_ARGS], {
      cwd: contractsRoot,
      encoding: "utf8",
      stdio: ["ignore", output, "pipe"],
    });
    if (result.error) throw result.error;
    const report = readFileSync(reportPath, "utf8");
    if (!report.trim()) throw new Error(`solhint printed no report: ${String(result.stderr).trim()}`);
    const parsed = parseSolhintReport(report);
    // Solhint exits 0 on warnings alone; a failure its report does not explain is not a pass.
    if (result.status !== 0 && !parsed.errors.length) throw new Error(`solhint exited ${result.status} without reporting an error: ${String(result.stderr).trim()}`);
    return parsed;
  } finally {
    closeSync(output);
    rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * The sources a change touches since `ref`, as `git diff -M` sees them in `cwd`: `changed` holds
 * every path, both sides of a rename and untracked files included, and `renames` maps a new path
 * to its old one. A git failure throws: an empty set would turn every stale entry into a note.
 */
export function sourceChanges(cwd, ref) {
  const changed = new Set();
  const renames = new Map();
  const fields = runGit(cwd, ["diff", "-M", "--name-status", "-z", ref, "--", SOURCES]).stdout.split("\0");
  for (let at = 0; at < fields.length && fields[at]; ) {
    const status = fields[at];
    if (/^[RC]/.test(status)) {
      if (status.startsWith("R")) renames.set(fields[at + 2], fields[at + 1]);
      changed.add(fields[at + 1]).add(fields[at + 2]);
      at += 3;
    } else {
      changed.add(fields[at + 1]);
      at += 2;
    }
  }
  for (const file of runGit(cwd, ["ls-files", "--others", "--exclude-standard", "-z", "--", SOURCES]).stdout.split("\0")) {
    if (file) changed.add(file);
  }
  return { changed, renames };
}

/**
 * The base to compare the baseline with, its copy of the baseline, and the sources changed and
 * renamed since. CI names the base it fetched in SOLHINT_BASELINE_BASE_REF; when that does not
 * resolve, the growth check cannot run, so the check fails rather than pass without it. A base
 * given with `--base` takes the place of CI's. `root` is the repository to read.
 */
export function baseContext(argv, { root = repoRoot } = {}) {
  const explicitBase = parseBaseArgs(argv).base;
  const base = resolveGitBase({ repoRoot: root, explicitBase, environmentVariables: ["SOLHINT_BASELINE_BASE_REF"] });
  const required = explicitBase ?? process.env.SOLHINT_BASELINE_BASE_REF;
  if (required && base !== required) throw new Error(`the base ${required} is not available, so the baseline cannot be compared with it`);
  if (!base) return { base: null, previous: null, renames: new Map(), changed: null };
  const ref = runGit(root, ["merge-base", "HEAD", base], { allowFailure: true }).stdout.trim() || base;
  const shown = runGit(root, ["show", `${ref}:${BASELINE_PATH}`], { allowFailure: true });
  const previous = shown.status === 0 ? parseBaseline(shown.stdout) : null;
  return { base, previous, ...sourceChanges(root, ref) };
}

function main(argv = process.argv.slice(2)) {
  const shrink = argv.includes(SHRINK_FLAG);
  const context = baseContext(argv.filter((argument) => argument !== SHRINK_FLAG));
  const { errors, warnings } = runSolhint();
  const counts = countWarnings(warnings);
  const baselineFile = path.join(repoRoot, BASELINE_PATH);
  if (!shrink && !existsSync(baselineFile)) {
    console.error(`solhint: ${BASELINE_PATH} is missing; record today's warnings with ${SHRINK_FLAG}`);
    return 1;
  }
  const baseline = existsSync(baselineFile) ? parseBaseline(readFileSync(baselineFile, "utf8")) : null;
  if (shrink) {
    if (errors.length) {
      for (const error of errors) console.error(`solhint: error ${error.filePath}:${error.line} ${error.ruleId ?? "parse"}: ${error.message}`);
      return 1;
    }
    const next = baseline ? shrinkBaseline(baseline, counts, context.renames) : counts;
    writeFileSync(baselineFile, formatBaseline(next));
    console.log(`solhint: ${warnings.length} warning(s) recorded in ${BASELINE_PATH}`);
    return 0;
  }
  const { ok, lines, notes } = judge({
    errors,
    counts,
    baseline,
    previous: context.previous,
    renames: context.renames,
    changed: context.changed,
    places: warningLines(warnings),
  });
  for (const line of lines) console.error(`solhint: ${line}`);
  for (const note of notes) console.log(`solhint: note: ${note}`);
  if (ok) {
    const compared = context.previous ? `, and the baseline has not grown since ${context.base}` : "";
    console.log(`solhint: ${warnings.length} warning(s), none new${compared}.`);
  }
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`solhint baseline check could not run: ${error.message}`);
    process.exitCode = 2;
  }
}
