#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const guidanceExact = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "ONBOARDING.md",
  "scripts/quality/check-codex-docs.js",
]);
const guidancePrefixes = [
  ".codex/",
  ".claude/",
  ".plans/",
  "docs/routines/",
  "scripts/harness/",
  "scripts/quality/check-guidance-links",
  "scripts/quality/check-skill-behavior-contracts",
  "scripts/quality/check-immutable-plan-reports",
  "scripts/quality/check-qa-id-ledger",
];

const supplyExact = new Set([
  "package.json",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bunfig.toml",
  ".npmrc",
  "pnpm-workspace.yaml",
  ".yarnrc.yml",
  ".mise.toml",
]);

const parityExact = new Set([
  ".github/actions/setup-js/action.yml",
  ".husky/pre-push",
  ".claude/settings.json",
  ".claude/scripts/task-completion-gate.sh",
  "scripts/data/validation-policy.json",
  "scripts/dev/ci-local.js",
  "scripts/dev/ci-local.test.mjs",
  "scripts/quality/classify-supply-chain-changes.mjs",
  "scripts/quality/select-validation.mjs",
  "scripts/quality/select-validation.test.mjs",
  "scripts/quality/workflow-performance-parity.test.mjs",
]);

function startsWithAny(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function classifySupplyChainChanges(paths, { workflowDispatch = false } = {}) {
  const normalized = [...new Set(paths.filter(Boolean).map((path) => path.replaceAll("\\", "/")))];
  if (workflowDispatch) {
    return { format: true, guidance: true, supply: true, parity: true };
  }

  return {
    // The workflow's outer path filter already limits this to repository text/config changes.
    // Keeping format true guarantees a successful non-skipped job for every triggered run.
    format: true,
    guidance: normalized.some(
      (path) => guidanceExact.has(path) || startsWithAny(path, guidancePrefixes),
    ),
    supply: normalized.some(
      (path) =>
        supplyExact.has(path) ||
        path.endsWith("/package.json") ||
        path.startsWith(".github/actions/") ||
        path.startsWith(".github/workflows/"),
    ),
    parity: normalized.some(
      (path) => parityExact.has(path) || path.startsWith(".github/workflows/"),
    ),
  };
}

function parseArguments(argv) {
  const options = { workflowDispatch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow-dispatch") options.workflowDispatch = true;
    else if (arg === "--changed-file") options.changedFile = argv[++index];
    else if (arg === "--github-output") options.githubOutput = argv[++index];
    else throw new Error(`Unknown classifier argument: ${arg}`);
  }
  if (!options.changedFile && !options.workflowDispatch) {
    throw new Error("Supply Chain classifier requires --changed-file or --workflow-dispatch");
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const paths = options.changedFile
    ? readFileSync(resolve(options.changedFile), "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const result = classifySupplyChainChanges(paths, options);
  const output = `${Object.entries(result)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
  if (options.githubOutput) appendFileSync(resolve(options.githubOutput), output);
  else process.stdout.write(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
