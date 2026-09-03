import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  catalogLifecycleRegressions,
  ledgerRegressions,
  parseCatalogCases,
  parseLedger,
} from "./check-qa-id-ledger.mjs";

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

test("locks retired ids and rejects an issued id reintroduced after catalog removal", () => {
  assert.deepEqual(
    catalogLifecycleRegressions(
      ["PUB-001", "PUB-002", "PUB-003"],
      [
        { id: "PUB-001", status: "retired" },
        { id: "PUB-003", status: "active" },
      ],
      [
        { id: "PUB-001", status: "active" },
        { id: "PUB-002", status: "active" },
      ],
    ),
    ["reactivated: PUB-001", "catalog removed: PUB-003", "reused: PUB-002"],
  );
});

test("accepts an active case retiring and new ids being appended", () => {
  assert.deepEqual(
    catalogLifecycleRegressions(
      ["PUB-001"],
      [{ id: "PUB-001", status: "active" }],
      [
        { id: "PUB-001", status: "retired" },
        { id: "PUB-002", status: "active" },
      ],
    ),
    [],
  );
});

test("rejects a ledger that is not JSON or has no string ids", () => {
  assert.throws(() => parseLedger("{ nope", "fixture"), /not valid JSON/);
  assert.throws(() => parseLedger('{"ids": "PUB-001"}', "fixture"), /string array/);
  assert.throws(() => parseLedger('{"ids": []}', "fixture"), /string array/);
  assert.throws(() => parseLedger('{"ids": ["PUB-001", 7]}', "fixture"), /string array/);
});

test("rejects malformed catalog lifecycle snapshots", () => {
  assert.throws(() => parseCatalogCases("{ nope", "fixture"), /not valid JSON/);
  assert.throws(() => parseCatalogCases('{"cases": [{"id": "PUB-001"}]}', "fixture"), /active\|retired/);
});

test("passes against its own commit", () => {
  const result = spawnSync(process.execPath, [script, "--base", "HEAD"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /none removed, reintroduced, or reactivated/);
});
