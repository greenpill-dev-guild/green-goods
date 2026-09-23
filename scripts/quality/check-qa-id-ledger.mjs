#!/usr/bin/env node
/**
 * Append-only guard for scripts/data/qa-test-id-ledger.json.
 *
 * The catalog contract test proves the ledger and the catalog agree at one
 * revision; it cannot see a later revision that drops an id from both files or
 * reuses it. This guard compares both the ledger and catalog lifecycle with the
 * merge-base of the resolved base ref, so removed ids, reintroduced ids, and
 * retired ids made active again fail on their own — the same base-vs-head shape
 * as check-immutable-plan-reports.
 *
 *   node scripts/quality/check-qa-id-ledger.mjs [--base <ref>]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
export const LEDGER_PATH = "scripts/data/qa-test-id-ledger.json";
export const CATALOG_PATH = "scripts/data/qa-test-catalog.json";

export function parseLedger(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  const ids = parsed?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error(`${label} must carry a non-empty string array at ids`);
  }
  return ids;
}

/** Every base id must survive into head, and head must not repeat an id. */
export function ledgerRegressions(baseIds, headIds) {
  const failures = [];
  const seen = new Set();
  for (const id of headIds) {
    if (seen.has(id)) failures.push(`duplicate: ${id}`);
    seen.add(id);
  }
  for (const id of baseIds) {
    if (!seen.has(id)) failures.push(`removed: ${id}`);
  }
  return failures;
}

export function parseCatalogCases(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (
    !Array.isArray(parsed?.cases) ||
    parsed.cases.length === 0 ||
    parsed.cases.some(
      (testCase) =>
        typeof testCase?.id !== "string" ||
        !testCase.id.trim() ||
        (testCase.status !== "active" && testCase.status !== "retired"),
    )
  ) {
    throw new Error(`${label} must carry cases with string ids and active|retired status`);
  }
  const ids = new Set(parsed.cases.map((testCase) => testCase.id));
  if (ids.size !== parsed.cases.length) {
    throw new Error(`${label} must not carry duplicate case ids`);
  }
  return parsed.cases.map(({ id, status }) => ({ id, status }));
}

/** Retired ids are tombstones; an issued id missing at base cannot be reintroduced later. */
export function catalogLifecycleRegressions(baseIssuedIds, baseCases, headCases) {
  const failures = [];
  const baseById = new Map(baseCases.map((testCase) => [testCase.id, testCase]));
  const headById = new Map(headCases.map((testCase) => [testCase.id, testCase]));

  for (const testCase of baseCases) {
    const current = headById.get(testCase.id);
    if (!current) failures.push(`catalog removed: ${testCase.id}`);
    else if (testCase.status === "retired" && current.status !== "retired") {
      failures.push(`reactivated: ${testCase.id}`);
    }
  }
  for (const id of baseIssuedIds) {
    if (!baseById.has(id) && headById.has(id)) failures.push(`reused: ${id}`);
  }
  return failures;
}

function showAt(ref, filePath) {
  const shown = runGit(repoRoot, ["show", `${ref}:${filePath}`], { allowFailure: true });
  return shown.status === 0 ? shown.stdout : undefined;
}

function baseSnapshot(base) {
  if (!base) return { ref: undefined, ledgerIds: [], catalogCases: [] };
  const mergeBase = runGit(repoRoot, ["merge-base", base, "HEAD"], { allowFailure: true });
  const ref = mergeBase.status === 0 ? mergeBase.stdout.trim() : base;
  const ledger = showAt(ref, LEDGER_PATH);
  const catalog = showAt(ref, CATALOG_PATH);
  return {
    ref,
    // A base that predates the ledger has no issued-id history to protect yet.
    ledgerIds: ledger ? parseLedger(ledger, `${ref} ledger`) : [],
    catalogCases: catalog ? parseCatalogCases(catalog, `${ref} catalog`) : [],
  };
}

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({
      repoRoot,
      explicitBase: args.base,
      environmentVariables: ["QA_LEDGER_BASE_REF", "GUIDANCE_BASE_REF"],
    });
    const snapshot = baseSnapshot(base);
    const headIds = parseLedger(readFileSync(path.join(repoRoot, LEDGER_PATH), "utf8"), "working-tree ledger");
    const headCases = parseCatalogCases(
      readFileSync(path.join(repoRoot, CATALOG_PATH), "utf8"),
      "working-tree catalog",
    );
    const failures = [
      ...ledgerRegressions(snapshot.ledgerIds, headIds),
      ...catalogLifecycleRegressions(snapshot.ledgerIds, snapshot.catalogCases, headCases),
    ];
    if (failures.length > 0) {
      console.error(
        `check-qa-id-ledger: ${failures.length} Test ID lifecycle regression(s) against ${base ?? "no base"}:`,
      );
      for (const failure of failures) console.error(`- ${failure}`);
      console.error(
        "Test IDs are permanent addresses: keep every catalog row, leave retired ids retired, and append only new ids.",
      );
      process.exit(1);
    }
    console.log(
      `check-qa-id-ledger: ${headIds.length} ids, none removed, reintroduced, or reactivated since ${snapshot.ref ?? "no resolvable base"}.`,
    );
  } catch (error) {
    console.error(`check-qa-id-ledger: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
