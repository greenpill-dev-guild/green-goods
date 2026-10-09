#!/usr/bin/env node
/**
 * Delete the CodeQL overlay-base databases that no analysis can restore.
 *
 * CodeQL's default setup saves an overlay-base database, about 450 MB, to the Actions cache after
 * every analysis of develop, under a key that ends in the commit and the run. A pull request's
 * analysis looks the database up by restore key, and a restore key returns the newest cache it
 * matches, so only the newest database per branch, restore key and cache version is ever read. The
 * older ones stay until GitHub evicts them, and at the 10 GB repository limit GitHub evicts the
 * least recently used caches first: on 2026-09-28, 22 databases held 9.9 GB and the contracts
 * jobs' Foundry caches had been evicted.
 *
 * Usage: node scripts/ops/prune-codeql-caches.mjs [--dry-run]
 * Needs gh with a token that can write Actions (GH_TOKEN in CI). GITHUB_REPOSITORY names the
 * repository and defaults to this one.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KEY_PREFIX = "codeql-overlay-base-database-";
// codeql-overlay-base-database-<format>-<components hash>-<languages>-<CLI version>-<commit>-<run>-<attempt>,
// as github/codeql-action builds it (src/overlay/caching.ts): the languages are sorted and joined
// with "_", and only stable x.y.z CLI versions are ever restored. Everything before the commit is
// the restore key that CodeQL looks the database up by. A key in any other shape is left alone.
const OVERLAY_KEY =
  /^(codeql-overlay-base-database-\d+-[0-9a-f]+-[a-z]+(?:_[a-z]+)*-\d+\.\d+\.\d+-)[0-9a-f]{40}-\d+-\d+$/;

const isNewer = (cache, than) =>
  (Date.parse(cache.created_at) - Date.parse(than.created_at) || cache.id - than.id) > 0;

/**
 * The databases nothing can restore: every overlay-base database except the newest per branch,
 * restore key and cache version. A cache belongs to the ref that saved it, each language set and CLI
 * version has its own restore key, and a restore only matches a cache of the same version (a stamp
 * of its paths and compression), so each version keeps its own newest. Caches with any other key,
 * including an overlay key in a shape this does not recognise, are never returned.
 */
export function unreachableOverlayDatabases(caches) {
  const newest = new Map();
  for (const cache of caches) {
    const restoreKey = cache.key.match(OVERLAY_KEY)?.[1];
    if (!restoreKey) continue;
    const group = `${cache.ref}\u0000${cache.version}\u0000${restoreKey}`;
    const kept = newest.get(group);
    if (!kept || isNewer(cache, kept)) newest.set(group, cache);
  }
  const kept = new Set([...newest.values()].map((cache) => cache.id));
  return caches.filter((cache) => OVERLAY_KEY.test(cache.key) && !kept.has(cache.id));
}

/**
 * Lists the repository's overlay-base databases through `gh` and deletes the unreachable ones. A
 * database GitHub evicted after the listing is skipped; any other failed delete stops the run.
 */
export function pruneOverlayDatabases({ repository, dryRun = false, gh, log = console.log }) {
  const caches = gh([
    "api",
    "--paginate",
    `repos/${repository}/actions/caches?key=${KEY_PREFIX}&per_page=100`,
    "--jq",
    ".actions_caches[]",
  ])
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const unreachable = unreachableOverlayDatabases(caches);
  const megabytes = Math.round(
    unreachable.reduce((total, cache) => total + cache.size_in_bytes, 0) / 1048576,
  );
  log(
    `${caches.length} overlay-base databases, ${unreachable.length} unreachable (${megabytes} MB)${dryRun ? "; dry run" : ""}`,
  );
  let deleted = 0;
  for (const cache of unreachable) {
    log(`${dryRun ? "would delete" : "deleting"} ${cache.id} ${cache.ref} ${cache.key}`);
    if (dryRun) continue;
    try {
      gh(["api", "--method", "DELETE", `repos/${repository}/actions/caches/${cache.id}`]);
      deleted += 1;
    } catch (error) {
      if (!/HTTP 404/.test(String(error.stderr ?? error.message))) throw error;
      log(`${cache.id} was already gone`);
    }
  }
  return { listed: caches.length, unreachable: unreachable.length, deleted };
}

function main() {
  pruneOverlayDatabases({
    repository: process.env.GITHUB_REPOSITORY ?? "greenpill-dev-guild/green-goods",
    dryRun: process.argv.includes("--dry-run"),
    gh: (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
