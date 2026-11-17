#!/usr/bin/env node
// Holds knip's findings (unused files, exports, types and dependencies, unlisted and unresolved
// imports, duplicate exports) to a shrink-only baseline, the same rules as the solhint and
// React-pattern baselines. A finding the baseline does not name fails, so dead code cannot be
// added; a recorded finding that is gone fails in a file the change touches until
// `--baseline-shrink` records it, so the baseline stays tight; and the baseline may not grow over
// the base branch's copy. Findings are kept by name, not counted, so removing one unused export
// does not make room for another.
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BASELINE_PATH = "scripts/data/knip-baseline.json";
// The kinds of finding the baseline holds. `owners` names code owners, not a finding.
export const ISSUE_TYPES = [
  "files",
  "dependencies",
  "devDependencies",
  "optionalPeerDependencies",
  "unlisted",
  "binaries",
  "unresolved",
  "exports",
  "types",
  "enumMembers",
  "namespaceMembers",
  "duplicates",
  "catalog",
  "catalogReferences",
];
// A change to these can move findings in files it does not touch: knip's configuration, the
// lockfile that pins knip and its plugins, and the TypeScript settings that resolve imports.
const isKnipInput = (file) => file === "knip.ts" || file === "bun.lock" || /(^|\/)tsconfig[^/]*\.json$/.test(file);
const SHRINK_FLAG = "--baseline-shrink";
const SHRINK_COMMAND = `node scripts/quality/check-knip-baseline.mjs ${SHRINK_FLAG}`;
const NOTE =
  "Shrink-only: knip's findings per kind and file. Entries may be removed, never added; record removals with `node scripts/quality/check-knip-baseline.mjs --baseline-shrink`.";

const nameOf = (type, item) =>
  type === "duplicates" ? item.map((entry) => entry.name).sort().join(" = ") : String(item.name);

/**
 * Knip's JSON report as findings: kind, then file, then the sorted names in it, plus the line of
 * each so a failure can name it. Configuration files knip loads can print to stdout first, so the
 * report is the last line that parses as one.
 */
export function parseKnipReport(text) {
  const report = text
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((parsed) => Array.isArray(parsed?.issues))
    .at(-1);
  if (!report) throw new Error("knip printed no JSON report");
  const findings = {};
  const places = new Map();
  for (const entry of report.issues) {
    for (const type of ISSUE_TYPES) {
      for (const item of entry[type] ?? []) {
        const name = nameOf(type, item);
        ((findings[type] ??= {})[entry.file] ??= new Set()).add(name);
        const line = Array.isArray(item) ? item[0]?.line : item.line;
        if (line) places.set(JSON.stringify([type, entry.file, name]), line);
      }
    }
  }
  return { findings: sortFindings(findings), places };
}

function sortFindings(findings) {
  return Object.fromEntries(
    Object.keys(findings)
      .sort()
      .map((type) => [
        type,
        Object.fromEntries(
          Object.keys(findings[type])
            .sort()
            .map((file) => [file, [...new Set(findings[type][file])].sort()]),
        ),
      ])
      .filter(([, files]) => Object.keys(files).length),
  );
}

function eachFinding(findings, visit) {
  for (const [type, files] of Object.entries(findings ?? {})) {
    for (const [file, names] of Object.entries(files)) for (const name of names) visit(type, file, name);
  }
}

const has = (findings, type, file, name) => findings?.[type]?.[file]?.includes(name) ?? false;
const movedTo = (renames) => new Map([...renames].map(([to, from]) => [from, to]));

/**
 * Findings the baseline does not name (added) and baseline entries knip no longer reports (stale).
 * `renames` maps a new path to its old one: a renamed file adds nothing while it keeps its old
 * findings, but every baseline entry is judged at its own path, so the old path's entry is stale
 * until `--baseline-shrink` moves it and the baseline never keeps a path that is gone.
 */
export function compareFindings(baseline, findings, renames = new Map()) {
  const added = [];
  const stale = [];
  eachFinding(findings, (type, file, name) => {
    if (!has(baseline, type, file, name) && !has(baseline, type, renames.get(file), name)) added.push({ type, file, name });
  });
  eachFinding(baseline, (type, file, name) => {
    if (!has(findings, type, file, name)) stale.push({ type, file, name });
  });
  return { added, stale };
}

/** Baseline entries the base branch's copy does not have; nothing when the base has no baseline. */
export function baselineGrowth(baseline, previous, renames = new Map()) {
  if (!previous) return [];
  const grown = [];
  eachFinding(baseline, (type, file, name) => {
    if (!has(previous, type, file, name) && !has(previous, type, renames.get(file), name)) grown.push({ type, file, name });
  });
  return grown;
}

/** The baseline without the findings knip no longer reports. Refuses while any finding is new. */
export function shrinkBaseline(baseline, findings, renames = new Map()) {
  const { added } = compareFindings(baseline, findings, renames);
  if (added.length) throw new Error(`refusing to shrink: ${added.length} finding(s) are not in the baseline`);
  const targets = movedTo(renames);
  const next = {};
  eachFinding(baseline, (type, file, name) => {
    const target = targets.get(file) ?? file;
    if (has(findings, type, target, name)) ((next[type] ??= {})[target] ??= []).push(name);
  });
  return sortFindings(next);
}

/** The findings of a version 1 baseline. Throws on anything else. */
export function parseBaseline(source) {
  const document = JSON.parse(source);
  if (document?.version !== 1 || !document.findings || typeof document.findings !== "object" || Array.isArray(document.findings)) {
    throw new Error(`${BASELINE_PATH} is not a version 1 baseline`);
  }
  for (const [type, files] of Object.entries(document.findings)) {
    if (!ISSUE_TYPES.includes(type)) throw new Error(`${BASELINE_PATH}: ${type} is not a kind of knip finding`);
    if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error(`${BASELINE_PATH}: ${type} is not an object of files`);
    for (const [file, names] of Object.entries(files)) {
      if (!Array.isArray(names) || !names.length || !names.every((name) => typeof name === "string" && name)) {
        throw new Error(`${BASELINE_PATH}: ${type} ${file} is not a list of names`);
      }
    }
  }
  return document.findings;
}

// Biome's JSON layout (biome.json: two-space indent, a 100-column line), so the file lint-staged
// formats on commit is the file `--baseline-shrink` writes: a list that fits on its line stays on it.
const LINE_WIDTH = 100;

export function formatBaseline(findings) {
  const text = (value) => JSON.stringify(value);
  const types = Object.keys(findings);
  const lines = ["{", '  "version": 1,', `  "note": ${text(NOTE)},`, types.length ? '  "findings": {' : '  "findings": {}'];
  types.forEach((type, typeAt) => {
    lines.push(`    ${text(type)}: {`);
    const files = Object.entries(findings[type]);
    files.forEach(([file, names], fileAt) => {
      const comma = fileAt < files.length - 1 ? "," : "";
      const inline = `      ${text(file)}: [${names.map(text).join(", ")}]${comma}`;
      if (inline.length <= LINE_WIDTH) lines.push(inline);
      else lines.push(`      ${text(file)}: [`, ...names.map((name, at) => `        ${text(name)}${at < names.length - 1 ? "," : ""}`), `      ]${comma}`);
    });
    lines.push(`    }${typeAt < types.length - 1 ? "," : ""}`);
  });
  if (types.length) lines.push("  }");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/**
 * What fails, the lines that say so, and notes that do not fail. A stale entry fails only in a file
 * the change touches (`changed`; every file when the base is unknown or knip's inputs changed), so
 * two removals that merge together do not block every change. Pure, so every case can be tested.
 */
export function judge({ findings, baseline, previous = null, renames = new Map(), changed = null, places = new Map() }) {
  const lines = [];
  const notes = [];
  const { added, stale } = compareFindings(baseline, findings, renames);
  for (const { type, file, name } of added) {
    const line = places.get(JSON.stringify([type, file, name]));
    lines.push(`new finding in ${file}${line ? `:${line}` : ""}: ${type} ${name}`);
  }
  for (const { type, file, name } of stale) {
    if (changed === null || changed.has(file)) lines.push(`stale baseline for ${file}: ${type} ${name} is gone; record it with \`${SHRINK_COMMAND}\``);
    else notes.push(`stale baseline for ${file}: ${type} ${name} is gone, in a file this change does not touch; \`${SHRINK_COMMAND}\` records it`);
  }
  for (const { type, file, name } of baselineGrowth(baseline, previous, renames)) {
    lines.push(`baseline grew for ${file}: ${type} ${name} is not in the base branch's copy`);
  }
  return { ok: lines.length === 0, lines, notes };
}

// Knip can exit before a pipe drains, so its report goes to a file. Exit 1 means findings; any
// other failure, such as a configuration knip could not load, is not a pass.
function runKnip() {
  const folder = mkdtempSync(path.join(tmpdir(), "knip-report-"));
  const reportPath = path.join(folder, "report.json");
  const output = openSync(reportPath, "w");
  try {
    const result = spawnSync("bun", ["--bun", "node_modules/.bin/knip", "--reporter", "json", "--no-progress"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", output, "pipe"],
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== 1) throw new Error(`knip exited ${result.status}: ${String(result.stderr).trim()}`);
    return parseKnipReport(readFileSync(reportPath, "utf8"));
  } finally {
    closeSync(output);
    rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * The files a change touches since `ref`, as `git diff -M` sees them in `cwd`: `changed` holds every
 * path, both sides of a rename and untracked files included, and `renames` maps a new path to its
 * old one. A change to knip's inputs touches every file: `changed` is then null. A git failure
 * throws: an empty set would turn every stale entry into a note.
 */
export function changedFiles(cwd, ref) {
  const changed = new Set();
  const renames = new Map();
  const fields = runGit(cwd, ["diff", "-M", "--name-status", "-z", ref]).stdout.split("\0");
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
  for (const file of runGit(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout.split("\0")) {
    if (file) changed.add(file);
  }
  return { changed: [...changed].some(isKnipInput) ? null : changed, renames };
}

/**
 * The base to compare the baseline with, its copy of the baseline, and the files changed and renamed
 * since. CI names the base it fetched in KNIP_BASELINE_BASE_REF; when that does not resolve, the
 * growth check cannot run, so the check fails rather than pass without it. A base given with
 * `--base` takes the place of CI's. `root` is the repository to read.
 */
export function baseContext(argv, { root = repoRoot } = {}) {
  const explicitBase = parseBaseArgs(argv).base;
  const base = resolveGitBase({ repoRoot: root, explicitBase, environmentVariables: ["KNIP_BASELINE_BASE_REF"] });
  const required = explicitBase ?? process.env.KNIP_BASELINE_BASE_REF;
  if (required && base !== required) throw new Error(`the base ${required} is not available, so the baseline cannot be compared with it`);
  if (!base) return { base: null, previous: null, renames: new Map(), changed: null };
  const ref = runGit(root, ["merge-base", "HEAD", base], { allowFailure: true }).stdout.trim() || base;
  const shown = runGit(root, ["show", `${ref}:${BASELINE_PATH}`], { allowFailure: true });
  const previous = shown.status === 0 ? parseBaseline(shown.stdout) : null;
  return { base, previous, ...changedFiles(root, ref) };
}

function main(argv = process.argv.slice(2)) {
  const shrink = argv.includes(SHRINK_FLAG);
  const context = baseContext(argv.filter((argument) => argument !== SHRINK_FLAG));
  const { findings, places } = runKnip();
  let total = 0;
  eachFinding(findings, () => total++);
  const baselineFile = path.join(repoRoot, BASELINE_PATH);
  if (!shrink && !existsSync(baselineFile)) {
    console.error(`knip: ${BASELINE_PATH} is missing; record today's findings with ${SHRINK_FLAG}`);
    return 1;
  }
  const baseline = existsSync(baselineFile) ? parseBaseline(readFileSync(baselineFile, "utf8")) : null;
  if (shrink) {
    const next = baseline ? shrinkBaseline(baseline, findings, context.renames) : findings;
    writeFileSync(baselineFile, formatBaseline(next));
    console.log(`knip: ${total} finding(s) recorded in ${BASELINE_PATH}`);
    return 0;
  }
  const { ok, lines, notes } = judge({ findings, baseline, previous: context.previous, renames: context.renames, changed: context.changed, places });
  for (const line of lines) console.error(`knip: ${line}`);
  for (const note of notes) console.log(`knip: note: ${note}`);
  if (ok) {
    const compared = context.previous ? `, and the baseline has not grown since ${context.base}` : "";
    console.log(`knip: ${total} finding(s), none new${compared}.`);
  }
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`knip baseline check could not run: ${error.message}`);
    process.exitCode = 2;
  }
}
