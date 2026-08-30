#!/usr/bin/env node
/**
 * QA app build — copy the page and project the catalog beside it.
 *
 * The catalog lives at the repo root (scripts/data/qa-test-catalog.json) and is
 * the upstream source of truth for scenario DEFINITIONS. Projecting it into
 * dist/ at build time keeps the page a plain static file with no bundler, and
 * keeps the running app pinned to the catalog revision it was deployed from —
 * a case can never change shape underneath a session in progress.
 *
 * Only ACTIVE cases ship: retired rows stay in the catalog as an audit trail
 * and must never appear on a run sheet.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(packageDir, "..", "..");
const outDir = path.join(packageDir, "dist");

/** The fields the page actually renders — everything else stays server-side. */
function projectCase(testCase) {
  return {
    id: testCase.id,
    tab: testCase.tab,
    area: testCase.area,
    pri: testCase.priority,
    scenario: testCase.scenario,
    expected: testCase.expected,
    rp: Boolean(testCase.requiresProduction),
    rd: Boolean(testCase.requiresDevice),
    tx: Boolean(testCase.tags?.includes("tx")),
  };
}

const catalogPath = path.join(repoRoot, "scripts", "data", "qa-test-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const active = catalog.cases.filter((testCase) => testCase.status !== "retired");

if (active.length === 0) {
  throw new Error(`qa-app build: no active cases found in ${catalogPath}`);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(packageDir, "index.html"), path.join(outDir, "index.html"));
writeFileSync(
  path.join(outDir, "catalog.json"),
  `${JSON.stringify({ version: catalog.version, tabs: catalog.tabs, cases: active.map(projectCase) })}\n`,
);

const perTab = catalog.tabs.map((tab) => `${tab} ${active.filter((c) => c.tab === tab).length}`);
console.log(`qa-app build: ${active.length} active cases (${perTab.join(", ")}) -> dist/`);
