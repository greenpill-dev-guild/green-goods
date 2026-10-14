#!/usr/bin/env node
// The docs deployment's gate chain. It lives here rather than inline in
// vercel.json because Vercel caps buildCommand at 256 characters.
//
// These run as direct commands rather than through `bun run check --only ...`:
// a Vercel build checkout has no origin/develop for the dispatcher's
// changed-path planning, and its Node is whatever "22.x" resolves to rather
// than the exact version the dispatcher's toolchain comparison expects.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const node = process.execPath;

const steps = [
  [node, ["docs/scripts/docs-audit.mjs", "--ci"]],
  [node, ["scripts/docs/generate.mjs", "--check"]],
  [node, ["scripts/dev/node-cli.js", "node", "--test", "scripts/quality/check-ontology.test.mjs"]],
  [node, ["scripts/quality/check-ontology.mjs"]],
  [node, ["scripts/quality/check-skill-behavior-contracts.mjs"]],
  ["bun", ["run", "--cwd", "docs", "test"]],
  ["bun", ["run", "--cwd", "docs", "build"]],
];

for (const [command, args] of steps) {
  process.stdout.write(`\n$ ${[command === node ? "node" : command, ...args].join(" ")}\n`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", shell: false });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
