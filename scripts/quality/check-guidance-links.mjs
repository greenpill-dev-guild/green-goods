#!/usr/bin/env node
// Guidance-content drift guard: verifies that agent guidance stays executable.
// 1. Every relative markdown link in guidance files resolves to a real file.
// 2. Every `bun run <script>` a guidance file mentions exists in the root or a
//    package `package.json` (package-scoped mentions are legitimate guidance).
// Caller: `bun run drift:check` (guidance scope) via scripts/quality/drift-check.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function walk(dir, out = []) {
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
const LINK_RE = /\]\(([^)#\s]+?\.md)(#[^)]*)?\)/g;
const RUN_RE = /`bun run ([a-z0-9:._-]+)`/g;

for (const file of guidanceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);

  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    if (target.startsWith("http")) continue;
    const resolved = path.normalize(path.join(path.dirname(file), target));
    if (!fs.existsSync(resolved)) failures.push(`${rel}: broken link -> ${target}`);
  }

  for (const m of text.matchAll(RUN_RE)) {
    const script = m[1];
    if (!knownScripts.has(script)) failures.push(`${rel}: unknown script -> bun run ${script}`);
  }
}

if (failures.length > 0) {
  console.error(`check-guidance-links: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(
  `check-guidance-links: ${guidanceFiles.length} guidance files OK (links resolve, bun-run scripts exist).`,
);
