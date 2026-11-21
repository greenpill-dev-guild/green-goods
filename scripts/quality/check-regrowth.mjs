#!/usr/bin/env node
// Stops two kinds of text the purge removed from growing back, judged only on what a change adds:
//
// - Comments the comment codemod's narrow pass removes (banners, commented-out code, labels and
//   notes that restate a name) on added lines of package source (`packages/*/src`, tests aside).
//   The codemod decides, so a comment whose place carries its meaning stays allowed.
// - New markdown that reads as a report (an audit, findings, a summary, a dated note) anywhere
//   outside `.plans/` and `docs/`, and any other new markdown outside those folders, the guidance
//   folders and the conventional names (README.md, AGENTS.md and the like).
//
// Existing text is not judged: a file is compared with the merge base, so only its added lines
// and added files count.
//
//   node scripts/quality/check-regrowth.mjs [--base <ref>]
//
// CI names its base in REGROWTH_BASE_REF; when that does not resolve the check fails rather than
// judge nothing.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";
import { purgeSource } from "./comment-policy.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const PACKAGE_SOURCE = /^packages\/[^/]+\/src\/.+\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|sol)$/;
const TEST_PATH = /(^|\/)(__tests__|__mocks__|test|tests)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/;
const GENERATED = /\.d\.[cm]?ts$|(^|\/)(generated|vendor|dist)\/|\.generated\./;

const MARKDOWN = /\.(md|mdx)$/i;
const MARKDOWN_HOMES = [".plans/", "docs/"];
const GUIDANCE_FOLDERS = [".claude/", ".agents/", ".codex/", ".github/"];
// A skill's references are its templates, a report template included.
const SKILL_FOLDERS = [".claude/skills/", ".agents/skills/"];
const CONVENTIONAL_NAMES =
  /^(README|AGENTS|CLAUDE|DESIGN[\w.-]*|SKILL|ARCHITECTURE|CHANGELOG|MODULES|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|LICENSES?)\.mdx?$/i;
const REPORT_NAME =
  /(^|[-_.\s])(report|reports|audit|audits|findings|summary|analysis|handoff|handover|retro|retrospective|postmortem|investigation|status|notes)([-_.\s]|$)|\d{4}-\d{2}-\d{2}/i;

export function isPackageSource(file) {
  return PACKAGE_SOURCE.test(file) && !TEST_PATH.test(file) && !GENERATED.test(file);
}

/** Why a new markdown file may not be added where it is, or null when it may. */
export function markdownProblem(file) {
  if (!MARKDOWN.test(file)) return null;
  if ([...MARKDOWN_HOMES, ...SKILL_FOLDERS].some((home) => file.startsWith(home))) return null;
  const name = path.posix.basename(file);
  if (REPORT_NAME.test(name.replace(MARKDOWN, ""))) {
    return "reads as a report; reports belong in the plan's hub under .plans/, or in Linear";
  }
  if (GUIDANCE_FOLDERS.some((folder) => file.startsWith(folder))) return null;
  if (CONVENTIONAL_NAMES.test(name)) return null;
  return "is new markdown outside .plans/ and docs/; put documentation in docs/ and plan notes in their hub";
}

/** Line numbers (1-based, in the new file) that a unified diff with no context adds. */
export function addedLines(diff) {
  const lines = new Set();
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let line = start; line < start + count; line += 1) lines.add(line);
  }
  return lines;
}

function lineOf(code, index) {
  return code.slice(0, index).split(/\r\n|[\n\r\u2028\u2029]/).length;
}

/** The comments the narrow purge would remove whose first line the change added. */
export function regrownComments(code, file, added) {
  return purgeSource(code, file)
    .removed.map((comment) => ({ line: lineOf(code, comment.start), kind: comment.kind, text: code.slice(comment.start, comment.end) }))
    .filter((comment) => added === "all" || added.has(comment.line));
}

/**
 * Paths the change adds or modifies, committed and uncommitted work and untracked files too, as
 * `{ how, from }`: a rename or copy is judged against the file it came from, so a move adds nothing.
 */
export function changedPaths(root, ref) {
  const entries = new Map();
  const status = runGit(root, ["diff", "--name-status", "-M", "-z", ref]).stdout.split("\0").filter(Boolean);
  for (let index = 0; index < status.length; ) {
    const how = status[index][0];
    if (how === "R" || how === "C") {
      entries.set(status[index + 2], { how, from: status[index + 1] });
      index += 3;
    } else {
      entries.set(status[index + 1], { how, from: null });
      index += 2;
    }
  }
  const untracked = runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout.split("\0").filter(Boolean);
  for (const file of untracked) entries.set(file, { how: "A", from: null });
  return entries;
}

export function judge(root, ref) {
  const problems = [];
  let sourceFiles = 0;
  for (const [file, { how, from }] of changedPaths(root, ref)) {
    if (how === "D") continue;
    if (how === "A") {
      const problem = markdownProblem(file);
      if (problem) problems.push(`${file}: ${problem}.`);
    }
    if (!isPackageSource(file)) continue;
    const absolute = path.join(root, file);
    if (!existsSync(absolute)) continue;
    sourceFiles += 1;
    const code = readFileSync(absolute, "utf8");
    // Whitespace is ignored, so re-indenting old comments (wrapping code in a block) adds none.
    const paths = from ? [from, file] : [file];
    const added =
      how === "A" ? "all" : addedLines(runGit(root, ["diff", "-U0", "-w", "-M", "--no-color", ref, "--", ...paths]).stdout);
    let comments;
    try {
      comments = regrownComments(code, file, added);
    } catch (error) {
      problems.push(`${file}: could not be parsed for comments (${error.message}).`);
      continue;
    }
    for (const comment of comments) {
      const shown = comment.text.split(/\r?\n/)[0].slice(0, 100);
      problems.push(`${file}:${comment.line}: new ${comment.kind} comment, which the purge removed: ${shown}`);
    }
  }
  return { problems, sourceFiles };
}

function main(argv = process.argv.slice(2)) {
  const explicitBase = parseBaseArgs(argv).base;
  const base = resolveGitBase({ repoRoot, explicitBase, environmentVariables: ["REGROWTH_BASE_REF"] });
  const required = explicitBase ?? process.env.REGROWTH_BASE_REF;
  if (!base || (required && base !== required)) {
    console.error(`regrowth: the base ${required ?? "origin/develop"} is not available, so nothing can be compared with it`);
    return 2;
  }
  const ref = runGit(repoRoot, ["merge-base", "HEAD", base], { allowFailure: true }).stdout.trim() || base;
  const { problems, sourceFiles } = judge(repoRoot, ref);
  for (const problem of problems) console.error(`regrowth: ${problem}`);
  if (problems.length) {
    console.error(
      "regrowth: delete the comment (the code or a name should carry it), and move a report into its plan hub or Linear.",
    );
    return 1;
  }
  console.log(`regrowth: nothing regrown since ${base} (${sourceFiles} package source file(s) read).`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`regrowth check could not run: ${error.message}`);
    process.exitCode = 2;
  }
}
