import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  BASELINE_PATH,
  baseContext,
  countWarnings,
  formatBaseline,
  judge,
  parseBaseline,
  parseSolhintReport,
  shrinkBaseline,
  sourceChanges,
  warningLines,
} from "./check-solhint-baseline.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VAULT = "packages/contracts/src/Vault.sol";
const POOL = "packages/contracts/src/Pool.sol";
const warning = (filePath, ruleId) => ({ filePath, ruleId, severity: "Warning", line: 1, message: "m" });
const SHRINK = "node scripts/contracts/check-solhint-baseline.mjs --baseline-shrink";

test("solhint's JSON report splits into errors and warnings, parse errors included, without its summary entry", () => {
  const report = JSON.stringify([
    warning("src/Vault.sol", "no-empty-blocks"),
    { ...warning("src/Pool.sol", "reason-string"), severity: "Error", line: 9, message: "reason" },
    { filePath: "src/Bad.sol", severity: "Error", line: 3, column: 1, message: "Parse error: missing ';'" },
    { conclusion: "3 problem/s (2 error/s, 1 warning/s)" },
  ]);
  const { errors, warnings } = parseSolhintReport(report);
  assert.deepEqual(errors.map((error) => error.ruleId ?? "parse"), ["reason-string", "parse"]);
  assert.deepEqual(countWarnings(warnings), { "no-empty-blocks": { [VAULT]: 1 } });
  assert.throws(() => parseSolhintReport("{}"), /JSON list/);
});

test("a count above the baseline fails, a new file included, and errors fail as before", () => {
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  assert.deepEqual(judge({ errors: [], counts: { "no-empty-blocks": { [VAULT]: 2 } }, baseline }), { ok: true, lines: [], notes: [] });
  // A failure names the lines the rule fires on.
  const places = warningLines([{ ...warning("src/Vault.sol", "no-empty-blocks"), line: 4 }, { ...warning("src/Vault.sol", "no-empty-blocks"), line: 9 }]);
  const grown = judge({ errors: [], counts: { "no-empty-blocks": { [VAULT]: 3 }, "gas-indexed-events": { [POOL]: 1 } }, baseline, places });
  assert.equal(grown.ok, false);
  assert.deepEqual(grown.lines, [
    `new warning in ${VAULT}: no-empty-blocks 3, the baseline allows 2 (lines 4, 9)`,
    `new warning in ${POOL}: gas-indexed-events 1, the baseline allows 0`,
  ]);
  const error = { filePath: "src/Pool.sol", ruleId: "reason-string", line: 9, message: "reason" };
  const parseError = { filePath: "src/Bad.sol", line: 3, message: "Parse error: missing ';'" };
  assert.deepEqual(judge({ errors: [error, parseError], counts: baseline, baseline }).lines, [
    "error src/Pool.sol:9 reason-string: reason",
    "error src/Bad.sol:3 parse: Parse error: missing ';'",
  ]);
});

test("a count below the baseline fails in a file the change touches until it is recorded, and the baseline may not outgrow the base", () => {
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  const lower = { "no-empty-blocks": { [VAULT]: 1 } };
  assert.deepEqual(judge({ errors: [], counts: lower, baseline }).lines, [
    `stale baseline for ${VAULT}: no-empty-blocks 1 left of 2; record it with \`${SHRINK}\` from the repository root`,
  ]);
  // In a file the change does not touch, a stale count is a note, not a failure.
  const elsewhere = judge({ errors: [], counts: lower, baseline, changed: new Set([POOL]) });
  assert.equal(elsewhere.ok, true);
  assert.equal(elsewhere.notes.length, 1);
  assert.equal(judge({ errors: [], counts: lower, baseline, changed: new Set([VAULT]) }).ok, false);
  const previous = { "no-empty-blocks": { [VAULT]: 1 } };
  assert.deepEqual(judge({ errors: [], counts: baseline, baseline, previous }).lines, [
    `baseline grew for ${VAULT}: no-empty-blocks 1 on the base, 2 here`,
  ]);
  assert.equal(judge({ errors: [], counts: baseline, baseline, previous: null }).ok, true);
});

test("a renamed source keeps its count, and its old path leaves the baseline before the rename merges", () => {
  const renames = new Map([[POOL, VAULT]]);
  const changed = new Set([POOL, VAULT]);
  const baseline = { "no-empty-blocks": { [VAULT]: 2 } };
  const counts = { "no-empty-blocks": { [POOL]: 2 } };
  // The rename grows nothing, but an entry for a path that is gone is stale until shrink moves it.
  assert.deepEqual(judge({ errors: [], counts, baseline, previous: baseline, renames, changed }).lines, [
    `stale baseline for ${VAULT}: no-empty-blocks 0 left of 2; record it with \`${SHRINK}\` from the repository root`,
  ]);
  const moved = shrinkBaseline(baseline, counts, renames);
  assert.deepEqual(moved, { "no-empty-blocks": { [POOL]: 2 } });
  // Then this change passes, and so does the next, whose diff no longer shows the rename.
  assert.equal(judge({ errors: [], counts, baseline: moved, previous: baseline, renames, changed }).ok, true);
  assert.equal(judge({ errors: [], counts, baseline: moved, previous: moved }).ok, true);
  // Keeping the old entry beside the new one is no extra allowance.
  assert.equal(judge({ errors: [], counts, baseline: { "no-empty-blocks": { [VAULT]: 2, [POOL]: 2 } }, previous: baseline, renames, changed }).ok, false);
  assert.deepEqual(shrinkBaseline(baseline, { "no-empty-blocks": { [POOL]: 1 } }, renames), { "no-empty-blocks": { [POOL]: 1 } });
});

test("a change's sources come from git: both sides of a rename, edits, deletions and new files", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-solhint-changes-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
    const source = (name, text) => {
      mkdirSync(path.join(root, "packages/contracts/src"), { recursive: true });
      writeFileSync(path.join(root, "packages/contracts/src", name), text);
    };
    git("init", "-q");
    source("Vault.sol", "contract Vault { function a() public {} function b() public {} }\n");
    source("Edit.sol", "contract Edit {}\n");
    source("Gone.sol", "contract Gone {}\n");
    source("Same.sol", "contract Same {}\n");
    mkdirSync(path.join(root, "scripts/data"), { recursive: true });
    writeFileSync(path.join(root, BASELINE_PATH), formatBaseline({ "no-empty-blocks": { "packages/contracts/src/Vault.sol": 2 } }));
    git("add", "--", "packages", "scripts");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    git("mv", "packages/contracts/src/Vault.sol", "packages/contracts/src/Pool.sol");
    source("Edit.sol", "contract Edit { }\n");
    git("rm", "-q", "--", "packages/contracts/src/Gone.sol");
    source("New.sol", "contract New {}\n");
    const { changed, renames } = sourceChanges(root, base);
    const src = (name) => `packages/contracts/src/${name}`;
    assert.deepEqual([...renames], [[src("Pool.sol"), src("Vault.sol")]]);
    assert.deepEqual([...changed].sort(), ["Edit.sol", "Gone.sol", "New.sol", "Pool.sol", "Vault.sol"].map(src));
    // The check's own context reads the same change, and the base's baseline, from its base.
    const context = baseContext(["--base", base], { root });
    assert.deepEqual([...context.changed].sort(), [...changed].sort());
    assert.deepEqual([...context.renames], [...renames]);
    assert.deepEqual(context.previous, { "no-empty-blocks": { [src("Vault.sol")]: 2 } });
    // A change to solhint's configuration touches every source.
    writeFileSync(path.join(root, "packages/contracts/.solhint.json"), "{}\n");
    git("add", "--", "packages/contracts/.solhint.json");
    assert.equal(sourceChanges(root, base).changed, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
