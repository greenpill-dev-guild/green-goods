#!/usr/bin/env node
/**
 * Bump the `"version"` field across the workspace (root + 6 packages) to a target
 * semver, keeping all package versions unified.
 *
 * Dependency-free (node:fs / node:path / node:url only). Does a surgical text
 * replace of the FIRST `"version"` field in each file rather than JSON
 * parse/stringify, so the diff is exactly one line per file and passes
 * `bun run format:check` (biome) untouched.
 *
 * Usage:
 *   bun run version:bump <x.y.z> [--dry-run]
 *
 * Examples:
 *   bun run version:bump 1.2.0            # monthly minor bump
 *   bun run version:bump 1.2.1            # hotfix patch bump
 *   bun run version:bump 1.2.0 --dry-run  # preview, write nothing
 *
 * Canonical release runbook: docs/docs/builders/deployments/releasing.mdx
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// The unified version set. Keep in sync if a new published package is added.
const TARGET_FILES = [
  "package.json",
  "packages/admin/package.json",
  "packages/agent/package.json",
  "packages/client/package.json",
  "packages/contracts/package.json",
  "packages/indexer/package.json",
  "packages/shared/package.json",
];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const VERSION_FIELD = /("version"\s*:\s*")([^"]+)(")/;

function fail(message) {
  console.error(`version:bump — ${message}`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const target = args.find((arg) => !arg.startsWith("--"));

  if (!target) fail("missing target version. Usage: bun run version:bump <x.y.z> [--dry-run]");
  if (!SEMVER.test(target)) fail(`invalid target version "${target}" (expected semver like 1.2.0)`);

  let updated = 0;
  let unchanged = 0;

  for (const rel of TARGET_FILES) {
    const abs = resolve(ROOT, rel);
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      fail(`cannot read ${rel} (expected to exist)`);
    }

    const match = text.match(VERSION_FIELD);
    if (!match) fail(`no "version" field found in ${rel}`);

    const current = match[2];
    if (current === target) {
      unchanged += 1;
      console.log(`  unchanged  ${rel} (already ${target})`);
      continue;
    }

    if (!dryRun) {
      writeFileSync(abs, text.replace(VERSION_FIELD, `$1${target}$3`));
    }
    updated += 1;
    console.log(`  ${dryRun ? "would set" : "updated "}  ${rel}: ${current} → ${target}`);
  }

  console.log(
    `\nversion:bump — ${dryRun ? "DRY RUN, no files written. " : ""}${updated} file(s) ${
      dryRun ? "would change" : "updated"
    }, ${unchanged} unchanged.`
  );
  if (updated > 0 && !dryRun) {
    console.log("Next: commit the bump on the release branch, then tag on merged-main HEAD.");
  }
}

main();
