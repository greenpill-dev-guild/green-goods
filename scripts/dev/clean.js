#!/usr/bin/env node

/**
 * Clean disposable artifacts in the current Green Goods checkout.
 *
 * This is intentionally local-only: it does not stop shared PM2/Docker
 * services, remove dependencies, touch env files, or inspect sibling worktrees.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function usage() {
  console.log(`Usage: node scripts/dev/clean.js [options]

Options:
  --dry-run        Print what would be removed.
  --with-indexer   Also remove local Envio runtime state, not generated source.
  --help           Show this help.

Default cleanup removes build, test, coverage, docs, Storybook, tunnel, tmp,
and Turbo artifacts from this checkout only.
`);
}

function parseArgs(argv) {
  const options = { dryRun: false, withIndexer: false };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--with-indexer") {
      options.withIndexer = true;
      continue;
    }

    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

function listDirs(dir) {
  try {
    return fs
      .readdirSync(path.join(projectRoot, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.posix.join(dir, entry.name));
  } catch {
    return [];
  }
}

function listMatches(dir, pattern) {
  try {
    return fs
      .readdirSync(path.join(projectRoot, dir), { withFileTypes: true })
      .filter((entry) => pattern.test(entry.name))
      .map((entry) => path.posix.join(dir, entry.name));
  } catch {
    return [];
  }
}

function dedupe(items) {
  return [...new Set(items)].sort();
}

function cleanupTargets() {
  const packageDirs = listDirs("packages");
  const packageArtifacts = packageDirs.flatMap((dir) => [
    `${dir}/.turbo`,
    `${dir}/.cache`,
    `${dir}/build`,
    `${dir}/coverage`,
    `${dir}/dist`,
  ]);

  const contractGenerated = [
    "packages/contracts/.generated/foundry/out",
    "packages/contracts/.generated/foundry/cache",
    "packages/contracts/out",
    "packages/contracts/cache",
    ...listMatches("packages/contracts", /^out-.+/),
    ...listMatches("packages/contracts", /^cache-.+/),
  ];

  const targets = [
    ".cache",
    ".parcel-cache",
    ".turbo",
    ".tunnel-url",
    ".tunnel-url-admin",
    "coverage",
    "debug-storybook.log",
    "dist",
    "dist-ssr",
    "dev-dist",
    "docs/.docusaurus",
    "docs/.turbo",
    "docs/build",
    "docs/.cache",
    "lighthouse-results",
    "output",
    "playwright-report",
    "storybook-static",
    "test-results",
    "tests/playwright-report",
    "tests/test-results",
    "tmp",
    ...packageArtifacts,
    ...contractGenerated,
    "packages/shared/storybook-static",
  ];

  if (options.withIndexer) {
    targets.push(
      "packages/indexer/.envio",
      "packages/indexer/artifacts",
      "packages/indexer/benchmarks",
      "packages/indexer/generated/persisted_state.envio.json"
    );
  }

  return dedupe(targets);
}

function assertSafeTarget(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const relative = path.relative(projectRoot, absolutePath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside project root: ${relativePath}`);
  }

  const protectedExact = new Set([
    ".agents",
    ".claude",
    ".codex",
    ".env",
    ".env.schema",
    ".env.template",
    ".git",
    ".github",
    ".plans",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "bun.lock",
    "node_modules",
    "package.json",
    "packages",
    "scripts",
  ]);

  const firstSegment = relative.split(path.sep)[0];
  const protectsWholePath = protectedExact.has(relative);
  const protectsTopLevelPath = protectedExact.has(firstSegment) && !relative.startsWith(`packages${path.sep}`);

  if (protectsWholePath || protectsTopLevelPath) {
    throw new Error(`Refusing to clean protected path: ${relativePath}`);
  }

  if (relative.startsWith(`packages${path.sep}`)) {
    const parts = relative.split(path.sep);
    if (parts.length < 3) {
      throw new Error(`Refusing to clean package root: ${relativePath}`);
    }
  }

  return absolutePath;
}

function clean() {
  process.chdir(projectRoot);

  const targets = cleanupTargets();
  const existing = [];
  const missing = [];

  for (const relativePath of targets) {
    const absolutePath = assertSafeTarget(relativePath);
    if (fs.existsSync(absolutePath)) {
      existing.push({ relativePath, absolutePath });
    } else {
      missing.push(relativePath);
    }
  }

  if (options.dryRun) {
    console.log("dev-clean: dry run");
    for (const item of existing) console.log(`  remove ${item.relativePath}`);
    console.log(`dev-clean: ${existing.length} existing target(s), ${missing.length} absent target(s).`);
    return;
  }

  for (const item of existing) {
    fs.rmSync(item.absolutePath, { recursive: true, force: true });
    console.log(`removed ${item.relativePath}`);
  }

  console.log(`dev-clean: removed ${existing.length} target(s); ${missing.length} target(s) were already absent.`);
}

clean();
