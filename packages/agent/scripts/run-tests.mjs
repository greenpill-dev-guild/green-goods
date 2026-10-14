#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const filters = process.argv.slice(2);
const sqliteFilters = filters.filter((filter) => filter.includes("storage.sqlite.test"));
const unitFilters = filters.filter((filter) => !filter.includes("storage.sqlite.test"));

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: packageDir,
    env: { ...process.env, APP_ENV: "test", ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (filters.length === 0 || unitFilters.length > 0) {
  run("node", ["../../scripts/dev/node-cli.js", "vitest", "run", ...unitFilters]);
}

// The SQLite integration config intentionally includes only storage.sqlite.test.ts.
// Run it for the full package gate, or when it is the focused target, but never
// append an unrelated focused unit-test path to that separate Vitest lane.
if (filters.length === 0 || sqliteFilters.length > 0) {
  run("bun", ["--bun", "run", "vitest", "run"], {
    AGENT_SQLITE_INTEGRATION: "true",
  });
}
