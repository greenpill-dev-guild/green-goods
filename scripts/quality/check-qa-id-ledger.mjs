#!/usr/bin/env node
/**
 * Append-only guard for scripts/data/qa-test-id-ledger.json.
 *
 * The catalog contract test proves the ledger and the catalog agree at one
 * revision; it cannot see a later revision that drops an id from both files or
 * reuses it. This guard compares the working-tree ledger with the ledger at the
 * merge-base of the resolved base ref, so a removed id fails on its own — the
 * same base-vs-head shape as check-immutable-plan-reports.
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

function baseLedgerIds(base) {
  if (!base) return [];
  const mergeBase = runGit(repoRoot, ["merge-base", base, "HEAD"], { allowFailure: true });
  const ref = mergeBase.status === 0 ? mergeBase.stdout.trim() : base;
  const shown = runGit(repoRoot, ["show", `${ref}:${LEDGER_PATH}`], { allowFailure: true });
  // A base that predates the ledger has nothing to protect yet.
  return shown.status === 0 ? parseLedger(shown.stdout, `${ref} ledger`) : [];
}

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({
      repoRoot,
      explicitBase: args.base,
      environmentVariables: ["QA_LEDGER_BASE_REF", "GUIDANCE_BASE_REF"],
    });
    const headIds = parseLedger(readFileSync(path.join(repoRoot, LEDGER_PATH), "utf8"), "working-tree ledger");
    const failures = ledgerRegressions(baseLedgerIds(base), headIds);
    if (failures.length > 0) {
      console.error(`check-qa-id-ledger: ${failures.length} ledger regression(s) against ${base ?? "no base"}:`);
      for (const failure of failures) console.error(`- ${failure}`);
      console.error("Test IDs are permanent addresses: keep the id and retire the case in the catalog instead.");
      process.exit(1);
    }
    console.log(`check-qa-id-ledger: ${headIds.length} ids, none removed since ${base ?? "no resolvable base"}.`);
  } catch (error) {
    console.error(`check-qa-id-ledger: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
