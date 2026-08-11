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
const RETIRED_SCAN_EXEMPT = new Set([
  ".claude/loop.md",
  "scripts/quality/check-guidance-links.mjs",
]);
const PERSISTENT_RETIRED_PATHS = [
  ".claude/skills/status/SKILL.md",
  ".claude/skills/design/spatial.md",
  ".claude/skills/design/materials.md",
  ".claude/skills/design/interaction.md",
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

const LINK_RE = /\]\(([^)#\s]+?\.mdx?)(#[^)]*)?\)/g;
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
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
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

export function deriveDeletedSurfaceRules(deletedPaths, knownPaths = []) {
  const rules = [];
  for (const deletedPath of deletedPaths) {
    const skillMatch = deletedPath.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/);
    if (skillMatch) {
      const name = skillMatch[1];
      const command = new RegExp(
        `(^|[^A-Za-z0-9_-])/${escapeRegex(name)}(?=$|[\\s\`'\",.)\\\]])`,
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

    if (deletedPath.startsWith(".claude/skills/") && /\.mdx?$/.test(deletedPath)) {
      const basename = path.basename(deletedPath);
      const shortPath = deletedPath.replace(/^\.claude\//, "");
      const basenameCollides = knownPaths.some(
        (knownPath) => knownPath !== deletedPath && path.basename(knownPath) === basename,
      );
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
            (!basenameCollides && line.includes(basename))
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
    for (const [index, line] of file.text.split(/\r?\n/).entries()) {
      for (const rule of rules) {
        if (
          rule.appliesTo(file.path) &&
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
  const escapedLabel = escapeRegex(label);
  const verb = RETIREMENT_NOTICE_RE.source;
  return (
    new RegExp(`${escapedLabel}.{0,50}${verb}`, "i").test(line) ||
    new RegExp(`${verb}.{0,50}${escapedLabel}`, "i").test(line)
  );
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
    file.includes("/dist/")
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

function main() {
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
    path.join(repoRoot, "CLAUDE.md"),
    path.join(repoRoot, "AGENTS.md"),
    path.join(repoRoot, "ONBOARDING.md"),
  ].filter((file) => fs.existsSync(file));
  const knownScripts = collectKnownScripts();

  for (const file of guidanceFiles) {
    const text = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(repoRoot, file);
    for (const match of text.matchAll(LINK_RE)) {
      const target = match[1];
      if (target.startsWith("http")) continue;
      const resolved = path.normalize(path.join(path.dirname(file), target));
      if (!fs.existsSync(resolved)) failures.push(`${relativePath}: broken link -> ${target}`);
    }

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
      for (const [index, line] of text.split("\n").entries()) {
        for (const pattern of RETIRED_PATTERNS) {
          const hit = typeof pattern === "string" ? line.includes(pattern) : pattern.test(line);
          const label = typeof pattern === "string" ? pattern : pattern.source;
          if (hit && !isExplicitRetirementNotice(line, label)) {
            failures.push(
              `${relativePath}:${index + 1}: reference to retired surface -> ${label}`,
            );
          }
        }
      }
    }
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
          runGit(repoRoot, ["diff", "--unified=0", "--no-color", `${base}...HEAD`]).stdout,
        ),
      );
    }
    mergeAddedLines(
      addedLineNumbersFromDiff(
        runGit(repoRoot, ["diff", "--unified=0", "--no-color", "HEAD"]).stdout,
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
  if (failures.length > 0) {
    console.error(`check-guidance-links: ${failures.length} failure(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `check-guidance-links: ${guidanceFiles.length} guidance files OK (links, commands, retirements, changed fences, and banner parity).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
