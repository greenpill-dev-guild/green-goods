import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ledgerRegressions, parseLedger } from "./check-qa-id-ledger.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-qa-id-ledger.mjs");

test("flags an id removed since the base and an id repeated in head", () => {
  assert.deepEqual(ledgerRegressions(["PUB-001", "XPLAT-004"], ["PUB-001", "PUB-002", "PUB-002"]), [
    "duplicate: PUB-002",
    "removed: XPLAT-004",
  ]);
});

test("accepts appends and an empty base", () => {
  assert.deepEqual(ledgerRegressions(["PUB-001"], ["PUB-001", "ADM-036"]), []);
  assert.deepEqual(ledgerRegressions([], ["PUB-001"]), []);
});

test("rejects a ledger that is not JSON or has no string ids", () => {
  assert.throws(() => parseLedger("{ nope", "fixture"), /not valid JSON/);
  assert.throws(() => parseLedger('{"ids": "PUB-001"}', "fixture"), /string array/);
  assert.throws(() => parseLedger('{"ids": ["PUB-001", 7]}', "fixture"), /string array/);
});

test("passes against its own commit", () => {
  const result = spawnSync(process.execPath, [script, "--base", "HEAD"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /none removed/);
});
