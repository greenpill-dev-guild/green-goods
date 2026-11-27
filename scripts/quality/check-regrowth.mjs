#!/usr/bin/env node
// Stops two kinds of text the purge removed from growing back, judged only on what a change adds:
//
// - Comments the comment codemod's narrow pass removes (banners, commented-out code, labels and
//   notes that restate a name) on added lines of package source (`packages/*/src`, tests aside).
//   The codemod decides, so a comment whose place carries its meaning stays allowed.
// - New markdown that reads as a report (an audit, findings, a summary, a dated note), anywhere:
//   a plan hub keeps its brief, spec, plan, eval and handoffs, and results go in the plan, the pull
//   request or Linear. Under `docs/`, new markdown belongs in the published pages, the routines or
//   a release's folder. Elsewhere, new markdown is limited to the guidance folders and the
//   conventional names (README.md, AGENTS.md and the like).
// - New code (scripts, contracts, pages, styles) in a plan hub, outside its `operations/` folder:
//   a one-shot operation's script lives in `operations/`, and a prototype on a branch or in
//   Storybook.
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
const PLANS = ".plans/";
// Published pages and release folders are named for what they document, so their names are not judged.
const DOCS_UNJUDGED = [/^docs\/docs\//, /^docs\/releases\/\d+\.\d+\.\d+[^/]*\//];
const DOCS_ROUTINES = "docs/routines/";
const DOCS_ROOT_FILE = /^docs\/[^/]+$/;
const PROTOTYPE_CODE =
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|html?|css|scss|vue|svelte|sol|yul|vy|sh|bash|zsh|py|ipynb|sql|go|rs|rb|java|kt|swift|php)$/i;
const GUIDANCE_FOLDERS = [".claude/", ".agents/", ".codex/", ".github/"];
// GitHub's issue and pull request templates are forms, whatever they are named for.
const GITHUB_TEMPLATE = /^\.github\/(ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)\//;
// A skill's references and templates may be named for the report they shape; a dated file, one
// under `reports/`, or a report-named file elsewhere in a skill is a record, not a template.
const SKILL_FOLDERS = [".claude/skills/", ".agents/skills/"];
const DATED = /\d{4}-\d{2}-\d{2}/;
// Lane-to-lane records live in a hub's `handoffs/`, whatever they are named.
const HUB_HANDOFF = /^\.plans\/[^/]+\/[^/]+\/handoffs\/[^/]+\.mdx?$/i;
const CONVENTIONAL_NAMES =
  /^(README|AGENTS|CLAUDE|DESIGN[\w.-]*|SKILL|ARCHITECTURE|CHANGELOG|MODULES|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|LICENSES?)\.mdx?$/i;
const REPORT_NAME =
  /(^|[-_.\s])(report|reports|audit|audits|findings|summary|analysis|handoff|handover|retro|retrospective|postmortem|investigation|status|notes)([-_.\s]|$)|\d{4}-\d{2}-\d{2}/i;

// In a plan hub these names are results too: a closeout, a verification, results, a review.
const HUB_REPORT_NAME = /(^|[-_.\s])(closeout|verification|results?|reviews?)([-_.\s]|$)/i;
const HUB_FILE = /^\.plans\/[^/]+\/([^/]+)\/(.+)$/;
// AGENTS.md sends a one-shot operation (a backfill, a migration, an on-chain batch) to its hub.
const HUB_OPERATION = /^\.plans\/[^/]+\/[^/]+\/operations\//;

export function isPackageSource(file) {
  return PACKAGE_SOURCE.test(file) && !TEST_PATH.test(file) && !GENERATED.test(file);
}

const REPORT_HOME = "record results in the hub's plan.todo.md, the pull request's Verification, or Linear";

/** Why a new file may not be added to a plan hub, or null when it may. */
export function planProblem(file) {
  if (!file.startsWith(PLANS)) return null;
  if (PROTOTYPE_CODE.test(file) && !HUB_OPERATION.test(file)) {
    return "is code in a plan hub outside operations/; a one-shot operation's script goes in the hub's operations/ folder, and a prototype on a branch or in Storybook";
  }
  const report = `reads as a report; plan hubs take no new reports, so ${REPORT_HOME}`;
  if (file.split("/").includes("reports")) return report;
  if (!MARKDOWN.test(file)) return null;
  const name = path.posix.basename(file);
  if (HUB_HANDOFF.test(file) && !DATED.test(name)) return null;
  const stem = name.replace(MARKDOWN, "");
  return REPORT_NAME.test(stem) || HUB_REPORT_NAME.test(stem) ? report : null;
}

/** Whether a move kept a file in its own hub at the same place, as a hub changing stage does. */
export function movedWithHub(from, file) {
  const before = HUB_FILE.exec(from);
  const after = HUB_FILE.exec(file);
  return Boolean(before && after && before[1] === after[1] && before[2] === after[2]);
}

/** Why a new markdown file may not be added where it is, or null when it may. */
export function markdownProblem(file) {
  if (!MARKDOWN.test(file)) return null;
  if (file.startsWith(PLANS)) return planProblem(file);
  if (SKILL_FOLDERS.some((home) => file.startsWith(home))) {
    const segments = file.split("/");
    const skillFile = path.posix.basename(file);
    const template = segments.includes("references") || segments.includes("templates") || /template/i.test(skillFile);
    const record = segments.includes("reports") || DATED.test(skillFile);
    return record || (!template && REPORT_NAME.test(skillFile.replace(MARKDOWN, "")))
      ? `reads as a report; ${REPORT_HOME}`
      : null;
  }
  if (DOCS_UNJUDGED.some((home) => home.test(file))) return null;
  const name = path.posix.basename(file);
  if (GITHUB_TEMPLATE.test(file)) return null;
  if (REPORT_NAME.test(name.replace(MARKDOWN, ""))) {
    return `reads as a report; ${REPORT_HOME}`;
  }
  if (file.startsWith(DOCS_ROUTINES)) return null;
  if (DOCS_ROOT_FILE.test(file)) {
    return CONVENTIONAL_NAMES.test(name) || /\.generated\.mdx?$/i.test(name)
      ? null
      : "is new markdown at the root of docs/; put pages in docs/docs/ and routines in docs/routines/";
  }
  if (file.startsWith("docs/")) {
    return "is new markdown outside docs/docs/, docs/routines/ and a release folder; published pages go in docs/docs/";
  }
  if (GUIDANCE_FOLDERS.some((folder) => file.startsWith(folder))) return null;
  if (CONVENTIONAL_NAMES.test(name)) return null;
  return "is new markdown outside .plans/ and docs/; put documentation in docs/ and plan notes in their hub";
}

/** Why a file may not be added where it is, or null when it may. */
export function newFileProblem(file) {
  return markdownProblem(file) ?? planProblem(file);
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
    // A move lands a file somewhere new, unless it was already where it may not be. A plan file is
    // carried only by its own hub changing stage (same hub, same place in it); moved anywhere
    // else, to another hub included, it is judged where it lands. So is any file that moves into
    // `.plans/`, wherever it came from.
    const carried = from?.startsWith(PLANS)
      ? movedWithHub(from, file)
      : Boolean(from && !file.startsWith(PLANS) && newFileProblem(from));
    if (how === "A" || (from && !carried)) {
      const problem = newFileProblem(file);
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
      "regrowth: delete the comment (the code or a name should carry it); put results in the plan, the pull request or Linear, one-shot scripts in the hub's operations/ folder, and prototypes on a branch.",
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
