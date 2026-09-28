#!/usr/bin/env node
// Shared Node tests that share one module graph must not need their own. Vitest reports each test
// file's project; a shared-graph file that needs its own graph under scripts/lib/vitest-shared-graph.mjs
// (it, or a test helper it imports, mocks, stubs, assigns globals, resets modules, uses IndexedDB, or
// carries an isolation marker) would leak into every later file in its worker, and a file listed by
// two projects would run twice.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ownGraphReason } from "../lib/vitest-shared-graph.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const sharedRoot = path.join(repoRoot, "packages/shared");
export const SHARED_GRAPH_PROJECT = "node-shared-graph";

/**
 * Membership problems in Vitest's `list --filesOnly --json` entries, as `file: reason` lines.
 * `reasonFor(file)` says why a file needs its own graph, or returns null.
 */
export function sharedGraphProblems(entries, reasonFor) {
  const projectsByFile = new Map();
  for (const { file, projectName } of entries) {
    projectsByFile.set(file, [...(projectsByFile.get(file) ?? []), projectName]);
  }
  const problems = [];
  for (const [file, projects] of [...projectsByFile].sort(([a], [b]) => a.localeCompare(b))) {
    if (projects.length > 1) problems.push(`${file}: runs in ${projects.join(" and ")}`);
    const reason = projects.includes(SHARED_GRAPH_PROJECT) ? reasonFor(file) : null;
    if (reason) {
      problems.push(`${file}: shares the module graph but needs its own, because ${reason} (scripts/lib/vitest-shared-graph.mjs)`);
    }
  }
  return problems;
}

function listSharedTests() {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "node_modules/.bin/vitest"), "list", "--filesOnly", "--json"],
    { cwd: sharedRoot, encoding: "utf8", env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" } },
  );
  if (result.status !== 0) throw new Error(`vitest list exited ${result.status}: ${result.stderr.trim()}`);
  const entries = JSON.parse(result.stdout.slice(result.stdout.indexOf("[")));
  if (!entries.some((entry) => entry.projectName === SHARED_GRAPH_PROJECT)) {
    throw new Error(`vitest list reported no ${SHARED_GRAPH_PROJECT} files`);
  }
  return entries.map(({ file, projectName }) => ({ file: path.relative(repoRoot, file), projectName }));
}

function main() {
  try {
    const entries = listSharedTests();
    const problems = sharedGraphProblems(entries, (file) =>
      ownGraphReason(path.relative(sharedRoot, path.join(repoRoot, file)), { root: sharedRoot }),
    );
    if (problems.length > 0) {
      console.error("Shared test project membership is wrong:");
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    const shared = entries.filter((entry) => entry.projectName === SHARED_GRAPH_PROJECT).length;
    console.log(`Shared test projects: ${entries.length} files, ${shared} in the shared graph, none needing their own.`);
  } catch (error) {
    console.error(`Shared-graph membership check could not run: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
