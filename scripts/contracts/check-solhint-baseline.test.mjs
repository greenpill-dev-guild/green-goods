import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BASELINE_PATH,
  countWarnings,
  formatBaseline,
  judge,
  parseBaseline,
  parseSolhintReport,
  shrinkBaseline,
} from "./check-solhint-baseline.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VAULT = "packages/contracts/src/Vault.sol";
const POOL = "packages/contracts/src/Pool.sol";
const warning = (filePath, ruleId) => ({ filePath, ruleId, severity: "Warning", line: 1, message: "m" });

test("solhint's JSON report splits into errors and warnings, without its summary entry", () => {
  const report = JSON.stringify([
    warning("src/Vault.sol", "no-empty-blocks"),
    { ...warning("src/Pool.sol", "reason-string"), severity: "Error", line: 9, message: "reason" },
    { conclusion: "2 problem/s (1 error/s, 1 warning/s)" },
  ]);
  const { errors, warnings } = parseSolhintReport(report);
  assert.deepEqual(errors.map((error) => error.ruleId), ["reason-string"]);
  assert.deepEqual(countWarnings(warnings), { "no-empty-blocks": { [VAULT]: 1 } });
  assert.throws(() => parseSolhintReport("{}"), /JSON list/);
});

test("a count above the baseline fails, a new file included, and errors fail as before", () => {
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  assert.deepEqual(judge({ errors: [], counts: { "no-empty-blocks": { [VAULT]: 2 } }, baseline }), { ok: true, lines: [] });
  const grown = judge({ errors: [], counts: { "no-empty-blocks": { [VAULT]: 3 }, "gas-indexed-events": { [POOL]: 1 } }, baseline });
  assert.equal(grown.ok, false);
  assert.deepEqual(grown.lines, [
    `new warning in ${VAULT}: no-empty-blocks 3, the baseline allows 2`,
    `new warning in ${POOL}: gas-indexed-events 1, the baseline allows 0`,
  ]);
  const error = { filePath: "src/Pool.sol", ruleId: "reason-string", line: 9, message: "reason" };
  assert.deepEqual(judge({ errors: [error], counts: baseline, baseline }).lines, ["error src/Pool.sol:9 reason-string: reason"]);
});

test("a count below the baseline fails until it is recorded, and the baseline may not outgrow the base", () => {
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  assert.deepEqual(judge({ errors: [], counts: { "no-empty-blocks": { [VAULT]: 1 } }, baseline }).lines, [
    `stale baseline for ${VAULT}: no-empty-blocks 1 left of 2; record it with --baseline-shrink`,
  ]);
  const previous = { "no-empty-blocks": { [VAULT]: 1 } };
  assert.deepEqual(judge({ errors: [], counts: baseline, baseline, previous }).lines, [
    `baseline grew for ${VAULT}: no-empty-blocks 1 on the base, 2 here`,
  ]);
  assert.equal(judge({ errors: [], counts: baseline, baseline, previous: null }).ok, true);
});

test("a renamed source keeps its old path's allowance", () => {
  const renames = new Map([[POOL, VAULT]]);
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  const counts = { "no-empty-blocks": { [POOL]: 2 } };
  assert.deepEqual(judge({ errors: [], counts, baseline, previous: baseline, renames }), { ok: true, lines: [] });
  assert.deepEqual(shrinkBaseline(baseline, { "no-empty-blocks": { [POOL]: 1 } }, renames), { "no-empty-blocks": { [POOL]: 1 } });
});

test("shrinking lowers counts, drops cleared files, and refuses while a count is above the baseline", () => {
  const baseline = { "no-empty-blocks": { [POOL]: 1, [VAULT]: 3 } };
  assert.deepEqual(shrinkBaseline(baseline, { "no-empty-blocks": { [VAULT]: 2 } }), { "no-empty-blocks": { [VAULT]: 2 } });
  assert.throws(() => shrinkBaseline(baseline, { "no-empty-blocks": { [VAULT]: 4 } }), /refusing to shrink/);
});

test("the baseline file is a version 1 document of positive whole counts, as the repository's is", () => {
  const counts = { "no-empty-blocks": { [VAULT]: 2 } };
  assert.deepEqual(parseBaseline(formatBaseline(counts)), counts);
  assert.throws(() => parseBaseline(JSON.stringify({ version: 2, counts })), /version 1/);
  assert.throws(() => parseBaseline(JSON.stringify({ version: 1, counts: { "no-empty-blocks": { [VAULT]: 0 } } })), /positive whole number/);
  assert.ok(Object.keys(parseBaseline(readFileSync(path.join(repoRoot, BASELINE_PATH), "utf8"))).length > 0);
});
