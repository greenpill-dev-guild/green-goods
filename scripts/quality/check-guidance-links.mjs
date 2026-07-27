#!/usr/bin/env node
// Guidance-content drift guard: verifies that agent guidance stays executable.
// 1. Every relative markdown link in guidance files resolves to a real file.
// 2. Every `bun run <script>` a guidance file mentions exists in the root or a
//    package `package.json` (package-scoped mentions are legitimate guidance).
// 3. No live references to retired guidance surfaces (mechanical name sweep —
//    the judgment-only prose forms stay in .claude/loop.md).
// 4. The SessionStart banner's slash-command list matches the set of skills
//    declaring `user-invocable: true`.
// Callers: `bun run drift:check` (guidance scope) via scripts/quality/drift-check.mjs,
// and the `guidance` job in .github/workflows/supply-chain-guardrails.yml.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "worktrees" || entry.name === "node_modules") continue;
      walk(p, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

const guidanceFiles = [
  ...walk(path.join(repoRoot, ".claude")),
  path.join(repoRoot, "CLAUDE.md"),
  path.join(repoRoot, "AGENTS.md"),
  path.join(repoRoot, "ONBOARDING.md"),
].filter((p) => fs.existsSync(p));

const knownScripts = new Set();
const pkgJsonPaths = [
  path.join(repoRoot, "package.json"),
  path.join(repoRoot, "docs", "package.json"),
  ...fs
    .readdirSync(path.join(repoRoot, "packages"))
    .map((d) => path.join(repoRoot, "packages", d, "package.json"))
    .filter((p) => fs.existsSync(p)),
].filter((p) => fs.existsSync(p));
for (const p of pkgJsonPaths) {
  const scripts = JSON.parse(fs.readFileSync(p, "utf8")).scripts ?? {};
  for (const name of Object.keys(scripts)) knownScripts.add(name);
}

const failures = [];
const LINK_RE = /\]\(([^)#\s]+?\.mdx?)(#[^)]*)?\)/g;
// Three shapes of script mention: inline-backtick, fenced/line-start (bun or npm),
// and the --filter package-scoped form. All validate against knownScripts.
const RUN_RES = [
  /`bun run (?!-)([a-z0-9:._-]+)[^`]*`/g,
  /(?:^|\n)\s*(?:bun|npm) run (?!-)([a-z0-9:._-]+)/g,
  /bun run --filter\s+\S+\s+([a-z0-9:._-]+)/g,
];

// Names retired by the lean-skills consolidations (#638 and round 2). Exact
// tokens and path/slash regexes only — prose forms that would false-positive
// ("react", "oracle", "<name> skill") stay a judgment check in .claude/loop.md.
// Add new retirements HERE, in the same commit that retires the surface.
const RETIRED_PATTERNS = [
  // Meta-infrastructure removed by #638 and follow-ups
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
  // Round-2 retirements (2026-07-25)
  "agent-output-gate",
  "context/docs.md",
  "context/intent.md",
  "skills/posthog-questions",
  // Retired domain-skill paths — their content lives in .claude/context/*.md
  /\bskills\/(react|testing|web3|data-layer|indexer|contracts|ops|ui)\b/,
  // Slash-command forms of folded skills (the form prompt sweeps kept missing)
  /(^|[\s`(])\/(principles|architecture|audit-then-ship|drift)\b/,
];
// Lines that are themselves retirement/archive notices are legitimate history.
// Word-bounded past/nominal forms only — bare stems would exempt live
// instructions ("remove X", "the folder") and gut the guard.
const RETIREMENT_NOTICE_RE =
  /\b(retired?|retirement|folded|removed|removal|replaced|renamed|deleted|deletion|archived|superseded|moved)\b/i;
// The retirement ledger and this checker's own documentation are exempt files.
const RETIRED_SCAN_EXEMPT = new Set([".claude/loop.md"]);

for (const file of guidanceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);

  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    if (target.startsWith("http")) continue;
    const resolved = path.normalize(path.join(path.dirname(file), target));
    if (!fs.existsSync(resolved)) failures.push(`${rel}: broken link -> ${target}`);
  }

  const seenScripts = new Set();
  for (const re of RUN_RES) {
    for (const m of text.matchAll(re)) {
      const script = m[1];
      if (seenScripts.has(script)) continue;
      seenScripts.add(script);
      if (!knownScripts.has(script)) failures.push(`${rel}: unknown script -> bun run ${script}`);
    }
  }

  if (!RETIRED_SCAN_EXEMPT.has(rel)) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (RETIREMENT_NOTICE_RE.test(line)) continue;
      for (const pattern of RETIRED_PATTERNS) {
        const hit =
          typeof pattern === "string" ? line.includes(pattern) : pattern.test(line);
        if (hit) {
          failures.push(
            `${rel}:${i + 1}: reference to retired surface -> ${typeof pattern === "string" ? pattern : pattern.source}`,
          );
        }
      }
    }
  }
}

// Banner ↔ frontmatter parity: the slash commands the SessionStart banner
// advertises must be exactly the skills declaring `user-invocable: true`.
let bannerCmd;
try {
  const settingsPath = path.join(repoRoot, ".claude", "settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  bannerCmd = (settings.hooks?.SessionStart ?? [])
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command ?? "")
    .find((cmd) => cmd.includes("Green Goods Claude Code"));
} catch (error) {
  failures.push(`.claude/settings.json: could not read/parse for banner parity check (${error.message})`);
}
if (bannerCmd === undefined && failures.every((f) => !f.includes("banner parity"))) {
  failures.push(
    ".claude/settings.json: SessionStart banner ('Green Goods Claude Code') not found (update this checker if the banner moved)",
  );
}
if (bannerCmd) {
  // Boundary before the slash so future URLs/paths in the banner text
  // (claude.ai/code/..., docs/foo) can't mint phantom skill names.
  const bannerSkills = new Set(
    [...bannerCmd.matchAll(/(^|[\s'])\/([a-z][a-z-]+)\b/g)].map((m) => m[2]),
  );
  const invocableSkills = new Set();
  const skillsDir = path.join(repoRoot, ".claude", "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    const frontmatter = fs.readFileSync(skillPath, "utf8").match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter && /^user-invocable:\s*true\b/m.test(frontmatter[1])) {
      invocableSkills.add(entry.name);
    }
  }
  for (const name of bannerSkills) {
    if (!invocableSkills.has(name))
      failures.push(`banner advertises /${name} but no skill declares user-invocable: true`);
  }
  for (const name of invocableSkills) {
    if (!bannerSkills.has(name))
      failures.push(`skill ${name} declares user-invocable: true but is missing from the SessionStart banner`);
  }
}

if (failures.length > 0) {
  console.error(`check-guidance-links: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(
  `check-guidance-links: ${guidanceFiles.length} guidance files OK (links resolve, bun-run scripts exist, no retired references, banner matches user-invocable skills).`,
);
