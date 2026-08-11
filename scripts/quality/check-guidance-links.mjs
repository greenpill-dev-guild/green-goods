#!/usr/bin/env node
// Guidance-content drift guard.
// - validates relative Markdown links and documented package scripts
// - rejects live references to statically retired guidance surfaces
// - derives deleted commands/guides from a Git base and scans current consumers
// - requires language tags on fenced blocks in changed Markdown/MDX files
// - keeps the SessionStart banner aligned with user-invocable skills

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");

const RETIREMENT_NOTICE_RE =
  /\b(retired?|retirement|folded|removed|removal|replaced|renamed|deleted|deletion|archived|superseded|moved)\b/i;
const RETIRED_SCAN_EXEMPT = new Set([".claude/loop.md"]);
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
const DOCUMENT_EXTENSIONS = new Set([".json", ".md", ".mdx", ".sh", ".yaml", ".yml"]);

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

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result;
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

export function findUntaggedFenceOpenings(text, relativePath) {
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
    if (!match[2].trim()) {
      failures.push(`${relativePath}:${index + 1}: fenced code block is missing a language tag`);
    }
  }
  return failures;
}

export function deriveDeletedSurfaceRules(deletedPaths) {
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
        appliesTo: (file) => DOCUMENT_EXTENSIONS.has(path.extname(file)),
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
      rules.push({
        label: basename,
        appliesTo: () => true,
        test: (line) => line.includes(basename) || line.includes(deletedPath) || line.includes(shortPath),
      });
    }
  }
  return rules;
}

export function scanDeletedSurfaceReferences(files, deletedPaths) {
  const failures = [];
  const rules = deriveDeletedSurfaceRules(deletedPaths);
  for (const file of files) {
    for (const [index, line] of file.text.split(/\r?\n/).entries()) {
      if (RETIREMENT_NOTICE_RE.test(line)) continue;
      for (const rule of rules) {
        if (rule.appliesTo(file.path) && rule.test(line)) {
          failures.push(`${file.path}:${index + 1}: reference to deleted surface -> ${rule.label}`);
        }
      }
    }
  }
  return [...new Set(failures)];
}

function parseArgs(argv) {
  let base;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--base") {
      if (!argv[index + 1]) throw new Error("--base requires a Git ref");
      base = argv[++index];
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return { base };
}

function resolveBase(explicitBase) {
  const candidate = explicitBase || process.env.GUIDANCE_BASE_REF;
  if (candidate) return candidate;
  const fallback = runGit(["rev-parse", "--verify", "--quiet", "origin/develop"], {
    allowFailure: true,
  });
  return fallback.status === 0 ? "origin/develop" : undefined;
}

function shouldScanConsumer(file) {
  if (file.startsWith(".plans/") || file.includes("/generated/") || file.includes("/dist/")) {
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
    const verified = runGit(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], {
      allowFailure: true,
    });
    if (verified.status !== 0) throw new Error(`base ref does not resolve to a commit: ${base}`);
    entries.push(
      ...parseNameStatus(
        runGit(["diff", "--name-status", "--find-renames", `${base}...HEAD`]).stdout,
      ),
    );
  }
  entries.push(
    ...parseNameStatus(runGit(["diff", "--name-status", "--find-renames", "HEAD"]).stdout),
  );
  entries.push(
    ...runGit(["ls-files", "--others", "--exclude-standard"])
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
    args = parseArgs(process.argv.slice(2));
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
        if (RETIREMENT_NOTICE_RE.test(line)) continue;
        for (const pattern of RETIRED_PATTERNS) {
          const hit = typeof pattern === "string" ? line.includes(pattern) : pattern.test(line);
          if (hit) {
            failures.push(
              `${relativePath}:${index + 1}: reference to retired surface -> ${typeof pattern === "string" ? pattern : pattern.source}`,
            );
          }
        }
      }
    }
  }

  try {
    const base = resolveBase(args.base);
    const diff = collectDiff(base);
    const deletedPaths = diff
      .filter((entry) => entry.status === "D" || entry.status === "R")
      .map((entry) => entry.oldPath ?? entry.path);
    const trackedPaths = runGit(["ls-files"]).stdout.split(/\r?\n/).filter(Boolean);
    const presentPaths = new Set([
      ...trackedPaths,
      ...diff
        .filter((entry) => entry.status !== "D" && fs.existsSync(path.join(repoRoot, entry.path)))
        .map((entry) => entry.path),
    ]);
    const consumers = [...presentPaths].filter(shouldScanConsumer).map((relativePath) => ({
      path: relativePath,
      text: fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
    }));
    failures.push(...scanDeletedSurfaceReferences(consumers, deletedPaths));

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
        failures.push(
          ...findUntaggedFenceOpenings(fs.readFileSync(absolutePath, "utf8"), relativePath),
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
