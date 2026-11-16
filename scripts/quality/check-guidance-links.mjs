#!/usr/bin/env node
// Guidance-content drift guard.
// - validates relative Markdown links and documented package scripts
// - rejects live references to statically retired guidance surfaces
// - derives deleted commands/guides from a Git base and scans current consumers
// - requires language tags on fenced blocks in changed Markdown/MDX files
// - keeps the SessionStart banner aligned with user-invocable skills

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");

const RETIREMENT_NOTICE_RE =
  /\b(retired?|retirement|folded|removed|removal|replaced|renamed|deleted|deletion|archived|superseded)\b/i;
const NEGATED_RETIREMENT_RE =
  /\b(?:not|never)\b(?:\W+\w+){0,3}\W+\b(?:retired?|folded|removed|replaced|renamed|deleted|archived|superseded)\b/i;
const RETIRED_SCAN_EXEMPT = new Set([
  ".claude/loop.md",
  "scripts/quality/check-guidance-links.mjs",
]);
const PERSISTENT_RETIRED_PATHS = [
  // Retirements integrated from develop in the 2.0 main promotion remain guarded.
  ".claude/context/docs.md",
  ".claude/context/intent.md",
  ".claude/skills/architecture/SKILL.md",
  ".claude/skills/audit-then-ship/SKILL.md",
  ".claude/skills/contracts/SKILL.md",
  ".claude/skills/contracts/security.md",
  ".claude/skills/data-layer/SKILL.md",
  ".claude/skills/data-layer/service-worker.md",
  ".claude/skills/data-layer/storage-lifecycle.md",
  ".claude/skills/design/generative-ui.md",
  ".claude/skills/design/stack-review.md",
  ".claude/skills/drift/SKILL.md",
  ".claude/skills/index.md",
  ".claude/skills/indexer/SKILL.md",
  ".claude/skills/indexer/docker.md",
  ".claude/skills/ops/SKILL.md",
  ".claude/skills/ops/biome.md",
  ".claude/skills/ops/ci-cd.md",
  ".claude/skills/ops/dependency-management.md",
  ".claude/skills/ops/deployment.md",
  ".claude/skills/ops/git-workflow.md",
  ".claude/skills/ops/migration.md",
  ".claude/skills/ops/vite.md",
  ".claude/skills/posthog-questions/SKILL.md",
  ".claude/skills/principles/SKILL.md",
  ".claude/skills/react/SKILL.md",
  ".claude/skills/react/compiler.md",
  ".claude/skills/react/error-handling.md",
  ".claude/skills/react/performance.md",
  ".claude/skills/react/tanstack-query.md",
  ".claude/skills/react/xstate.md",
  ".claude/skills/review/apply-fixes.md",
  ".claude/skills/review/cross-package-verify.md",
  ".claude/skills/testing/SKILL.md",
  ".claude/skills/testing/references/playwright.md",
  ".claude/skills/testing/references/vitest.md",
  ".claude/skills/testing/vitest-patterns.md",
  ".claude/skills/ui/SKILL.md",
  ".claude/skills/ui/compliance.md",
  ".claude/skills/ui/i18n.md",
  ".claude/skills/ui/mermaid.md",
  ".claude/skills/ui/radix-ui.md",
  ".claude/skills/ui/storybook-addons.md",
  ".claude/skills/ui/storybook-testing.md",
  ".claude/skills/ui/storybook.md",
  ".claude/skills/ui/tailwindcss.md",
  ".claude/skills/ui/view-transitions.md",
  ".claude/skills/web3/SKILL.md",
  ".claude/skills/status/SKILL.md",
  ".claude/skills/design/spatial.md",
  ".claude/skills/design/materials.md",
  ".claude/skills/design/interaction.md",
  ".claude/skills/debug/health-diagnostics.md",
  ".claude/skills/debug/monitoring.md",
  ".claude/skills/debug/posthog.md",
  ".claude/skills/design/quick-reference.md",
  ".claude/skills/design/regenerative.md",
];
const CONSUMER_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".cjs",
  ".scss",
  ".sh",
  ".sol",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const RETIRED_PATTERNS = [
  "registry/skills.json",
  "skills/index.md",
  "check:claude-guidance",
  "check-skill-frontmatter",
  "skill-bundles.json",
  "skills:sync",
  ".claude/hooks.json",
  "error-handling-patterns",
  "cracked-coder",
  "audit-then-ship",
  "agent-output-gate",
  "context/docs.md",
  "context/intent.md",
  "skills/posthog-questions",
  /\bskills\/(react|testing|web3|data-layer|indexer|contracts|ops|ui)\b/,
  /(^|[\s`(])\/(principles|architecture|audit-then-ship|drift)\b/,
];

// Code names guidance may write that no tracked source contains, each with the reason it stays.
// A name guidance mentions only to say it was removed needs no entry: a retirement notice covers it.
export const UNTRACKED_CODE_NAMES = new Map([
  ["anyoneWithLink", "Google Drive permission role"],
  ["fullText", "Google Drive search field"],
  ["modifiedTime", "Google Drive file field"],
  ["relatedTo", "Linear relation type"],
  ["sortOrder", "Linear API field"],
  ["externalIds", "Linear customer field"],
  ["CHANGES_REQUESTED", "GitHub review state"],
  ["reviewDecision", "GitHub GraphQL field"],
  ["reviewThreads", "GitHub GraphQL field"],
  ["isOutdated", "GitHub GraphQL field"],
  ["EnterWorktree", "Claude Code tool"],
  ["MockDb", "Envio's generated test database, not tracked"],
  ["POSTHOG_PROJECT_ID_APP", "routine environment variable, set outside the repository"],
  ["POSTHOG_PROJECT_ID_ADMIN", "routine environment variable, set outside the repository"],
  ["OUT_OF_SCOPE", "review verdict the skills define"],
  ["PATH_TRACED", "evidence label the skills define"],
  ["DEPENDENCY_WALKED", "evidence label the skills define"],
  ["LIVE_OBSERVED", "evidence label the skills define"],
  ["NEEDS_INPUT", "debug outcome the skill defines"],
  ["useXxxForm", "naming placeholder"],
  ["useEntity", "naming placeholder"],
  ["useEntityVerb", "naming placeholder"],
  ["useAdjective", "naming placeholder"],
  ["testRevert_", "test-name category the naming rule forbids"],
]);
// Records of past decisions and sample inputs, where a name may be one that has since gone.
const CODE_NAME_SCAN_EXEMPT = [/^\.claude\/skills\/design\/decision-log\.md$/, /^\.claude\/skills\/qa-triage\/fixtures\//];
// Root manifests and configuration count too, matched at the top level only: a plain `*.json`
// pathspec matches at every depth, which let plans and guidance-bearing settings vouch for names.
export const CODE_NAME_SOURCES = ["packages", "scripts", "tests", ".github", ".claude/hooks", ".claude/scripts", ".codex", "docs/src", "docs/scripts", ":(glob)*.json", ":(glob)*.toml"];
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|sol|json|ya?ml|sh|toml|graphql|css)$/;
// Configuration whose strings are guidance an agent reads: scanned like guidance, never a source.
export const CONFIGURATION_GUIDANCE = [".claude/settings.json"];

/** A backticked name that reads as code: camelCase, PascalCase with a second capital, or UPPER_SNAKE. */
function isCodeName(token) {
  return /^[A-Za-z_][\w]*$/.test(token) && token.length >= 4 &&
    (/[a-z][A-Z]/.test(token) || /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(token) || /^[a-z]+[A-Z]/.test(token));
}

/**
 * The code names an inline code span refers to: a bare name, or each name in a member path or
 * call such as `jobQueueDB.flush()` or `isStepValid(stepId)`. Arguments are left out: they are
 * often placeholders.
 */
function codeNamesIn(fragment) {
  const text = fragment.trim();
  // A JSX tag (`<DashboardLayout />`) names its component.
  const tag = text.match(/^<\/?([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*)(?:[\s/>].*)?$/);
  const reference = tag ?? text.match(/^[@$]?([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*)(?:\(.*\))?$/);
  return reference ? reference[1].split(".").filter(isCodeName) : [];
}

/** Code names in a guidance file's inline code that `knownNames` lacks; fenced examples are skipped. */
export function findUnknownCodeNames(text, relativePath, knownNames, allowed = UNTRACKED_CODE_NAMES) {
  const failures = [];
  let fenced = false;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      for (const token of codeNamesIn(match[1])) {
        if (knownNames.has(token) || allowed.has(token) || isExplicitRetirementNotice(line, token)) continue;
        failures.push(`${relativePath}:${index + 1}: no tracked source names \`${token}\``);
      }
    }
  }
  return failures;
}

/**
 * Every identifier the files contain or are named by, since guidance names files as well as code.
 * Guidance-bearing configuration and this checker's own test, which holds stale names as
 * fixtures, never vouch for one. Given a parser (`parseSync` from Vite), script comments are
 * blanked first.
 */
export function codeNamesFrom(files, read, parse) {
  const names = new Set();
  for (const file of files) {
    if (file === "scripts/quality/check-guidance-links.test.mjs" || CONFIGURATION_GUIDANCE.includes(file)) continue;
    for (const match of file.matchAll(/[A-Za-z_][\w]*/g)) names.add(match[0]);
    let text;
    try {
      text = read(file);
    } catch {
      continue;
    }
    for (const match of withoutComments(file, text, parse).matchAll(/[A-Za-z_][\w]*/g)) names.add(match[0]);
  }
  return names;
}

const SCRIPT_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

/**
 * A script's text with its comments blanked: a name a comment mentions ("the legacy
 * USER_FRIENDLY_ERRORS lookup") is a memory of code, not code. A file that does not parse keeps
 * its comments, so a parser gap never turns a live name stale.
 */
function withoutComments(file, text, parse) {
  if (!parse || !SCRIPT_FILE_RE.test(file)) return text;
  const lang = file.endsWith(".tsx") ? "tsx" : file.endsWith(".jsx") ? "jsx" : /\.[cm]?ts$/.test(file) ? "ts" : "js";
  const { comments, errors } = parse(file, text, { lang, sourceType: "module" });
  if (errors.length) return text;
  let kept = "";
  let at = 0;
  for (const comment of comments) {
    kept += `${text.slice(at, comment.start)} `;
    at = comment.end;
  }
  return kept + text.slice(at);
}

/** Every identifier in tracked source, scripts, tests, workflows, hooks and root configuration. */
function collectCodeNames(parse) {
  const files = runGit(repoRoot, ["ls-files", "--", ...CODE_NAME_SOURCES]).stdout.split(/\r?\n/)
    .filter((file) => CODE_FILE_RE.test(file));
  return codeNamesFrom(files, (file) => fs.readFileSync(path.join(repoRoot, file), "utf8"), parse);
}

const LINK_RE = /\]\(([^)#\s]+?\.mdx?)(#[^)]*)?\)/g;
const ROOT_CODE_PATH_RE = /`((?:docs|packages|scripts|\.claude)\/[^`\s]+?\.mdx?)`/g;
const RUN_RES = [
  /`bun run (?!-)([a-z0-9:._-]+)[^`]*`/g,
  /(?:^|\n)\s*(?:bun|npm) run (?!-)([a-z0-9:._-]+)/g,
  /bun run --filter\s+\S+\s+([a-z0-9:._-]+)/g,
];

function walkMarkdown(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "worktrees" || entry.name === "node_modules") continue;
      walkMarkdown(target, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(target);
    }
  }
  return out;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseNameStatus(output) {
  const entries = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    const status = fields[0];
    if ((status.startsWith("R") || status.startsWith("C")) && fields.length >= 3) {
      entries.push({ status: status[0], oldPath: fields[1], path: fields[2] });
    } else if (fields.length >= 2) {
      entries.push({ status: status[0], path: fields[1] });
    }
  }
  return entries;
}

export function findUntaggedFenceOpenings(text, relativePath, changedLines) {
  const failures = [];
  let openFence;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})(.*)$/);
    if (!match) continue;
    if (openFence) {
      if (match[1][0] === openFence[0] && match[1].length >= openFence.length) {
        openFence = undefined;
      }
      continue;
    }
    openFence = match[1];
    if (!match[2].trim() && (!changedLines || changedLines.has(index + 1))) {
      failures.push(`${relativePath}:${index + 1}: fenced code block is missing a language tag`);
    }
  }
  return failures;
}

export function findBrokenRootCodePaths(text, relativePath, exists) {
  const failures = [];
  for (const match of text.matchAll(ROOT_CODE_PATH_RE)) {
    if (/[?*<>]/.test(match[1])) continue;
    if (!exists(match[1])) failures.push(`${relativePath}: broken code path -> ${match[1]}`);
  }
  return failures;
}

export function findMissingInstructionSections(text, relativePath, instructions) {
  const failures = [];
  for (const match of text.matchAll(/(?:^|[^\w./-])((?:AGENTS|CLAUDE)\.md)[`* ]*§\s+([^`\n)\]]+)/g)) {
    const headings = [...(instructions[match[1]] ?? "").matchAll(/^#{1,6}\s+(.+)$/gm)]
      .map((heading) => heading[1].trim());
    const reference = match[2].trim();
    if (!headings.some((heading) => reference === heading ||
      (reference.startsWith(heading) && /^[\s*;:.,]/.test(reference.slice(heading.length))))) {
      failures.push(`${relativePath}: missing instruction section -> ${match[1]} § ${reference}`);
    }
  }
  return failures;
}

export function deriveDeletedSurfaceRules(deletedPaths, knownPaths = []) {
  const rules = [];
  for (const deletedPath of deletedPaths) {
    const skillMatch = deletedPath.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/);
    if (skillMatch) {
      const name = skillMatch[1];
      const command = new RegExp(
        `(^|[^A-Za-z0-9_./\\\\*-])/${escapeRegex(name)}(?![./][A-Za-z0-9])(?=$|[^A-Za-z0-9_-])`,
      );
      rules.push({
        label: `/${name}`,
        appliesTo: (file) => !(name === "status" && file.startsWith("packages/agent/")),
        test: (line) => command.test(line),
      });
      rules.push({
        label: `.claude/skills/${name}`,
        appliesTo: () => true,
        test: (line) => line.includes(`.claude/skills/${name}`) || line.includes(`skills/${name}`),
      });
      continue;
    }

    if (
      (deletedPath.startsWith(".claude/skills/") ||
        deletedPath.startsWith(".claude/context/")) &&
      /\.mdx?$/.test(deletedPath)
    ) {
      const basename = path.basename(deletedPath);
      const shortPath = deletedPath.replace(/^\.claude\//, "");
      const basenameCollides = ["index.md", "README.md", "SKILL.md"].includes(basename) || knownPaths.some(
        (knownPath) => knownPath !== deletedPath && path.basename(knownPath) === basename,
      );
      // Generic directory indexes require a path; an unrelated index.md is not this guide.
      // Other bare basenames count only as whole tokens: `playwright.md` must not match
      // `playwright.mdx`, `playwright.md.bak` or `playwright.md-notes`.
      const basenameToken = new RegExp(`(^|[^\\w./\\\\-])${escapeRegex(basename)}(?!\\w|[.-]\\w)`);
      rules.push({
        label: basename,
        appliesTo: () => true,
        test: (line, consumerPath) => {
          const relativePath = path.posix.relative(path.posix.dirname(consumerPath), deletedPath);
          return (
            line.includes(deletedPath) ||
            line.includes(shortPath) ||
            line.includes(relativePath) ||
            line.includes(`./${relativePath}`) ||
            (!basenameCollides && basenameToken.test(line))
          );
        },
      });
    }
  }
  return rules;
}

export function scanDeletedSurfaceReferences(
  files,
  deletedPaths,
  knownPaths = files.map((file) => file.path),
) {
  const failures = [];
  const rules = deriveDeletedSurfaceRules(deletedPaths, knownPaths);
  for (const file of files) {
    const matchingRules = rules.filter((rule) =>
      rule.appliesTo(file.path) && rule.test(file.text, file.path),
    );
    if (matchingRules.length === 0) continue;
    for (const [index, line] of file.text.split(/\r?\n/).entries()) {
      for (const rule of matchingRules) {
        if (
          rule.test(line, file.path) &&
          !isExplicitRetirementNotice(line, rule.label)
        ) {
          failures.push(`${file.path}:${index + 1}: reference to deleted surface -> ${rule.label}`);
        }
      }
    }
  }
  return [...new Set(failures)];
}

export function filterPresentPaths(paths, exists) {
  return [...new Set(paths)].filter((relativePath) => exists(relativePath));
}

function isExplicitRetirementNotice(line, label) {
  if (!RETIREMENT_NOTICE_RE.test(line)) return false;
  if (NEGATED_RETIREMENT_RE.test(line)) return false;
  const escapedLabel = escapeRegex(label);
  const verb = RETIREMENT_NOTICE_RE.source;
  return (
    new RegExp(`${escapedLabel}.{0,50}${verb}`, "i").test(line) ||
    new RegExp(`${verb}.{0,50}${escapedLabel}`, "i").test(line)
  );
}

export function scanPersistentRetiredReferences(files, patterns = RETIRED_PATTERNS) {
  const failures = [];
  for (const file of files) {
    for (const [index, line] of file.text.split(/\r?\n/).entries()) {
      for (const pattern of patterns) {
        const match = typeof pattern === "string" ? undefined : line.match(pattern);
        const hit = typeof pattern === "string" ? line.includes(pattern) : Boolean(match);
        const label =
          typeof pattern === "string"
            ? pattern
            : match?.[0].replace(/^[\s`(]+/, "") ?? pattern.source;
        if (hit && !isExplicitRetirementNotice(line, label)) {
          failures.push(
            `${file.path}:${index + 1}: reference to retired surface -> ${label}`,
          );
        }
      }
    }
  }
  return failures;
}

export function checkDecisionLogCitations(files, ledgerText) {
  const ledgerRows = [...ledgerText.matchAll(/^\|\s*(DL-\d+)\s*\|/gm)].map((match) => match[1]);
  const ledgerIds = new Set(ledgerRows);
  const failures = [];
  const seenIds = new Set();
  for (const id of ledgerRows) {
    if (seenIds.has(id)) {
      failures.push(
        `.claude/skills/design/decision-log.md: duplicate ledger id (IDs are never reused) -> ${id}`,
      );
    }
    seenIds.add(id);
  }
  for (const file of files) {
    for (const [index, line] of file.text.split(/\r?\n/).entries()) {
      for (const match of line.matchAll(/\bDL-\d+\b/g)) {
        if (!ledgerIds.has(match[0])) {
          failures.push(
            `${file.path}:${index + 1}: DL citation missing from design/decision-log.md ledger -> ${match[0]}`,
          );
        }
      }
    }
  }
  return failures;
}

export function findStaleLockedDecisions(ledgerText, now = new Date(), maxAgeDays = 30) {
  const warnings = [];
  const lockedRow = /^\|\s*(DL-\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|(?:[^|]*\|){2}\s*locked\s*\|/gm;
  for (const match of ledgerText.matchAll(lockedRow)) {
    const ageDays = (now - new Date(`${match[2]}T00:00:00Z`)) / 86_400_000;
    if (ageDays > maxAgeDays) {
      warnings.push(`${match[1]} locked since ${match[2]} — codify it or supersede it`);
    }
  }
  return warnings;
}

export function addedLineNumbersFromDiff(diff) {
  const linesByFile = new Map();
  let currentFile;
  let newLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      if (!linesByFile.has(currentFile)) linesByFile.set(currentFile, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (currentFile) linesByFile.get(currentFile)?.add(newLine);
      newLine++;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      newLine++;
    }
  }
  return linesByFile;
}

function shouldScanConsumer(file) {
  if (RETIRED_SCAN_EXEMPT.has(file)) return false;
  if (
    (file.startsWith(".plans/") && !file.startsWith(".plans/active/")) ||
    (file.startsWith(".plans/active/") && file.includes("/reports/")) ||
    file.includes("/generated/") ||
    file.includes("/dist/") ||
    file.endsWith("/artifacts/migration-ledger.json")
  ) {
    return false;
  }
  if (file.includes(".test.") || file.endsWith("bun.lock") || file.endsWith("package-lock.json")) {
    return false;
  }
  return CONSUMER_EXTENSIONS.has(path.extname(file));
}

function collectDiff(base) {
  const entries = [];
  if (base) {
    entries.push(
      ...parseNameStatus(
        runGit(repoRoot, ["diff", "--name-status", "--find-renames", `${base}...HEAD`]).stdout,
      ),
    );
  }
  entries.push(
    ...parseNameStatus(
      runGit(repoRoot, ["diff", "--name-status", "--find-renames", "HEAD"]).stdout,
    ),
  );
  entries.push(
    ...runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"])
      .stdout.split(/\r?\n/)
      .filter(Boolean)
      .map((file) => ({ status: "A", path: file })),
  );
  return [
    ...new Map(
      entries.map((entry) => [
        `${entry.status}:${entry.oldPath ?? ""}:${entry.path}`,
        entry,
      ]),
    ).values(),
  ];
}

function collectKnownScripts() {
  const knownScripts = new Set();
  const packagePaths = [
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "docs", "package.json"),
    ...fs
      .readdirSync(path.join(repoRoot, "packages"))
      .map((directory) => path.join(repoRoot, "packages", directory, "package.json"))
      .filter((file) => fs.existsSync(file)),
  ];
  for (const packagePath of packagePaths) {
    const scripts = JSON.parse(fs.readFileSync(packagePath, "utf8")).scripts ?? {};
    for (const name of Object.keys(scripts)) knownScripts.add(name);
  }
  return knownScripts;
}

function checkBannerParity(failures) {
  let bannerCommand;
  try {
    const settings = JSON.parse(
      fs.readFileSync(path.join(repoRoot, ".claude", "settings.json"), "utf8"),
    );
    bannerCommand = (settings.hooks?.SessionStart ?? [])
      .flatMap((entry) => entry.hooks ?? [])
      .map((hook) => hook.command ?? "")
      .find((command) => command.includes("Green Goods Claude Code"));
  } catch (error) {
    failures.push(`.claude/settings.json: could not read/parse for banner parity (${error.message})`);
  }
  if (bannerCommand === undefined) {
    failures.push(".claude/settings.json: SessionStart banner ('Green Goods Claude Code') not found");
    return;
  }

  const bannerSkills = new Set(
    [...bannerCommand.matchAll(/(^|[\s'])\/([a-z][a-z-]+)\b/g)].map((match) => match[2]),
  );
  const invocableSkills = new Set();
  const skillsDir = path.join(repoRoot, ".claude", "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const frontmatter = fs.readFileSync(skillFile, "utf8").match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter && /^user-invocable:\s*true\b/m.test(frontmatter[1])) {
      invocableSkills.add(entry.name);
    }
  }
  for (const name of bannerSkills) {
    if (!invocableSkills.has(name)) {
      failures.push(`banner advertises /${name} but no skill declares user-invocable: true`);
    }
  }
  for (const name of invocableSkills) {
    if (!bannerSkills.has(name)) {
      failures.push(`skill ${name} declares user-invocable: true but is missing from the banner`);
    }
  }
}

function checkDesignDecisionLedger(failures) {
  const ledgerRelative = ".claude/skills/design/decision-log.md";
  const files = [
    ...walkMarkdown(path.join(repoRoot, ".claude", "skills", "design")),
    path.join(repoRoot, ".claude", "rules", "frontend-design.md"),
  ]
    .filter((file) => fs.existsSync(file))
    .map((file) => ({
      path: path.relative(repoRoot, file),
      text: fs.readFileSync(file, "utf8"),
    }));
  const ledger = files.find((file) => file.path === ledgerRelative);
  if (!ledger) {
    if (files.some((file) => /\bDL-\d+\b/.test(file.text))) {
      failures.push(`${ledgerRelative}: missing, but DL-NNN citations exist in design guidance`);
    }
    return;
  }
  failures.push(...checkDecisionLogCitations(files, ledger.text));
  for (const warning of findStaleLockedDecisions(ledger.text)) {
    console.warn(`check-guidance-links: warning — ${warning}`);
  }
}

async function main() {
  const failures = [];
  let args;
  try {
    args = parseBaseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check-guidance-links: ${error.message}`);
    process.exit(2);
  }

  const guidanceFiles = [
    ...walkMarkdown(path.join(repoRoot, ".claude")),
    path.join(repoRoot, ".agents", "adapter.md"),
    ...walkMarkdown(path.join(repoRoot, ".github", "instructions")),
    ...fs.readdirSync(path.join(repoRoot, "packages"))
      .map((directory) => path.join(repoRoot, "packages", directory, "AGENTS.md")),
    path.join(repoRoot, "docs", "AGENTS.md"),
    path.join(repoRoot, "CLAUDE.md"),
    path.join(repoRoot, "AGENTS.md"),
    path.join(repoRoot, "ONBOARDING.md"),
  ].filter((file) => fs.existsSync(file));
  const knownScripts = collectKnownScripts();
  // Loaded here, not at the top: the brand-voice check imports this module before packages install.
  const { parseSync } = await import("vite");
  const knownCodeNames = collectCodeNames(parseSync);
  const instructions = Object.fromEntries(["AGENTS.md", "CLAUDE.md"].map((name) => [
    name, fs.existsSync(path.join(repoRoot, name)) ? fs.readFileSync(path.join(repoRoot, name), "utf8") : "",
  ]));

  for (const file of guidanceFiles) {
    const text = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(repoRoot, file);
    failures.push(...findMissingInstructionSections(text, relativePath, instructions));
    for (const match of text.matchAll(LINK_RE)) {
      const target = match[1];
      if (target.startsWith("http")) continue;
      const resolved = path.normalize(path.join(path.dirname(file), target));
      if (!fs.existsSync(resolved)) failures.push(`${relativePath}: broken link -> ${target}`);
    }
    failures.push(
      ...findBrokenRootCodePaths(text, relativePath, (target) =>
        fs.existsSync(path.join(repoRoot, target))
      )
    );

    const seenScripts = new Set();
    for (const regex of RUN_RES) {
      for (const match of text.matchAll(regex)) {
        const script = match[1];
        if (seenScripts.has(script)) continue;
        seenScripts.add(script);
        if (!knownScripts.has(script)) {
          failures.push(`${relativePath}: unknown script -> bun run ${script}`);
        }
      }
    }

    if (!RETIRED_SCAN_EXEMPT.has(relativePath)) {
      failures.push(
        ...scanPersistentRetiredReferences([{ path: relativePath, text }]),
      );
    }
    if (!CODE_NAME_SCAN_EXEMPT.some((pattern) => pattern.test(relativePath))) {
      failures.push(...findUnknownCodeNames(text, relativePath, knownCodeNames));
    }
  }
  for (const file of CONFIGURATION_GUIDANCE) {
    const absolute = path.join(repoRoot, file);
    if (fs.existsSync(absolute)) failures.push(...findUnknownCodeNames(fs.readFileSync(absolute, "utf8"), file, knownCodeNames));
  }

  try {
    const base = resolveGitBase({
      repoRoot,
      explicitBase: args.base,
      environmentVariables: ["GUIDANCE_BASE_REF"],
    });
    const diff = collectDiff(base);
    const deletedPaths = diff
      .filter((entry) => entry.status === "D" || entry.status === "R")
      .map((entry) => entry.oldPath ?? entry.path);
    const trackedPaths = runGit(repoRoot, ["ls-files"]).stdout.split(/\r?\n/).filter(Boolean);
    const presentPaths = new Set(
      filterPresentPaths(
        [
          ...trackedPaths,
          ...diff.filter((entry) => entry.status !== "D").map((entry) => entry.path),
        ],
        (relativePath) => fs.existsSync(path.join(repoRoot, relativePath)),
      ),
    );
    if (deletedPaths.length > 0) {
      const missingTombstones = deletedPaths.filter(
        (deletedPath) =>
          deriveDeletedSurfaceRules([deletedPath]).length > 0 &&
          !PERSISTENT_RETIRED_PATHS.includes(deletedPath),
      );
      for (const deletedPath of missingTombstones) {
        failures.push(
          `${deletedPath}: deleted guidance surface needs a persistent tombstone in check-guidance-links.mjs`,
        );
      }
      const consumers = [...presentPaths].filter(shouldScanConsumer).map((relativePath) => ({
        path: relativePath,
        text: fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
      }));
      failures.push(...scanDeletedSurfaceReferences(consumers, deletedPaths));
    }

    const changedConsumers = [...new Set(diff.map((entry) => entry.path))]
      .filter(
        (relativePath) =>
          shouldScanConsumer(relativePath) && fs.existsSync(path.join(repoRoot, relativePath)),
      )
      .map((relativePath) => ({
        path: relativePath,
        text: fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
      }));
    failures.push(
      ...scanDeletedSurfaceReferences(
        changedConsumers,
        PERSISTENT_RETIRED_PATHS,
        [...presentPaths],
      ),
    );

    const addedLines = new Map();
    const mergeAddedLines = (source) => {
      for (const [file, lines] of source) {
        const target = addedLines.get(file) ?? new Set();
        for (const line of lines) target.add(line);
        addedLines.set(file, target);
      }
    };
    if (base) {
      mergeAddedLines(
        addedLineNumbersFromDiff(
          runGit(repoRoot, ["diff", "--unified=0", "--no-color", `${base}...HEAD`,
            "--", "*.md", "*.mdx", ":(exclude).plans/**"]).stdout,
        ),
      );
    }
    mergeAddedLines(
      addedLineNumbersFromDiff(
        runGit(repoRoot, ["diff", "--unified=0", "--no-color", "HEAD",
          "--", "*.md", "*.mdx", ":(exclude).plans/**"]).stdout,
      ),
    );

    const changedMarkdown = new Set();
    for (const entry of diff) {
      if (entry.status === "D") continue;
      const relativePath = entry.path;
      if (
        !relativePath.startsWith(".plans/") &&
        (relativePath.endsWith(".md") || relativePath.endsWith(".mdx"))
      ) {
        changedMarkdown.add(relativePath);
      }
    }
    for (const relativePath of changedMarkdown) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (fs.existsSync(absolutePath)) {
        const entry = [...diff].reverse().find((candidate) => candidate.path === relativePath);
        if (!addedLines.has(relativePath) && entry?.status === "A") {
          const lineCount = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/).length;
          addedLines.set(
            relativePath,
            new Set(Array.from({ length: lineCount }, (_, index) => index + 1)),
          );
        }
        failures.push(
          ...findUntaggedFenceOpenings(
            fs.readFileSync(absolutePath, "utf8"),
            relativePath,
            addedLines.get(relativePath) ?? new Set(),
          ),
        );
      }
    }
  } catch (error) {
    failures.push(`diff-aware guidance checks could not run: ${error.message}`);
  }

  checkBannerParity(failures);
  checkDesignDecisionLedger(failures);
  if (failures.length > 0) {
    console.error(`check-guidance-links: ${failures.length} failure(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `check-guidance-links: ${guidanceFiles.length} guidance files OK (links, commands, code names, retirements, changed fences, banner parity, and DL citations).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) await main();
