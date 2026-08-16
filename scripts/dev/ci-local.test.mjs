import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  executePlan,
  loadPassingReceiptStore,
  parseArguments,
  savePassingReceiptStore,
} from "./ci-local.js";

function plan(checks, status = "ready") {
  return {
    status,
    policyVersion: 1,
    requestedIntent: "checkpoint",
    effectiveIntent: "checkpoint",
    risk: "routine",
    base: "base",
    head: "head",
    workingCopyFingerprint: "working-copy-1",
    changedPaths: ["scripts/dev/ci-local.js"],
    testPaths: {},
    requestedChecks: [],
    environment: { profile: "test", toolchain: {}, capabilities: {} },
    checks: checks.map((id) => ({
      id,
      command: `run ${id}`,
      cwd: ".",
      state: "pending",
      blockedBy: [],
      freshness: "exact-inputs",
      stopRule: "stop-dependent-checks",
      budgetSeconds: 1,
      mandatory: false,
    })),
  };
}

test("local execution fails fast by default", async () => {
  const calls = [];
  const result = await executePlan(plan(["first", "second"]), {
    runCheck: async (check) => {
      calls.push(check.id);
      return { ok: false, exitCode: 7, durationSeconds: 0.01 };
    },
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(calls, ["first"]);
  assert.equal(result.results[0].receiptInputs.cacheReuse.allowed, true);
});

test("explicit no-fail-fast continues independent checks", async () => {
  const calls = [];
  const result = await executePlan(plan(["first", "second"]), {
    failFast: false,
    runCheck: async (check) => {
      calls.push(check.id);
      return { ok: check.id === "second", exitCode: check.id === "second" ? 0 : 1 };
    },
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(calls, ["first", "second"]);
});

test("cancellation is terminal and starts no checks", async () => {
  const calls = [];
  const cancelledPlan = { ...plan(["first"]), status: "cancelled", stopReason: "user-cancelled" };
  const result = await executePlan(cancelledPlan, {
    runCheck: async (check) => calls.push(check.id),
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.exitCode, 130);
  assert.deepEqual(calls, []);
});

test("blocked checks remain explicit while runnable evidence is collected", async () => {
  const input = plan(["format", "contracts-test"], "blocked");
  input.checks[1].state = "blocked";
  input.checks[1].blockedBy = ["foundry"];
  const calls = [];
  const result = await executePlan(input, {
    runCheck: async (check) => {
      calls.push(check.id);
      return { ok: true, exitCode: 0 };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.exitCode, 2);
  assert.deepEqual(calls, ["format"]);
  assert.deepEqual(result.blocked, [{ id: "contracts-test", blockedBy: ["foundry"] }]);
});

test("passing receipt reuse is opt-in, exact, and never stores failures", async () => {
  const receiptStore = new Map();
  let calls = 0;
  const input = plan(["first"]);
  const first = await executePlan(input, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async () => {
      calls += 1;
      return { ok: true, exitCode: 0 };
    },
  });
  assert.equal(first.status, "passed");
  assert.equal(receiptStore.size, 1);

  const second = await executePlan(input, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async () => {
      throw new Error("exact receipt should have been reused");
    },
  });
  assert.equal(second.results[0].reused, true);
  assert.equal(calls, 1);

  const dirtyChanged = { ...input, workingCopyFingerprint: "working-copy-2" };
  await executePlan(dirtyChanged, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async () => {
      calls += 1;
      return { ok: true, exitCode: 0 };
    },
  });
  assert.equal(calls, 2);

  const failureStore = new Map();
  await executePlan(input, {
    reusePassingReceipts: true,
    receiptStore: failureStore,
    runCheck: async () => ({ ok: false, exitCode: 1 }),
  });
  assert.equal(failureStore.size, 0);
});

test("persisted receipt store rejects tampered receipt inputs", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-receipts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "receipts.json");
  const receiptStore = new Map();
  await executePlan(plan(["first"]), {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async () => ({ ok: true, exitCode: 0 }),
  });
  savePassingReceiptStore(receiptStore, path);
  assert.equal(loadPassingReceiptStore(path).size, 1);

  const stored = JSON.parse(readFileSync(path, "utf8"));
  const [fingerprint] = Object.keys(stored.receipts);
  stored.receipts[fingerprint].receiptInputs.command = "tampered command";
  writeFileSync(path, JSON.stringify(stored));
  assert.equal(loadPassingReceiptStore(path).size, 0);
});

test("legacy and selector arguments remain parseable", () => {
  const parsed = parseArguments([
    "--quick",
    "--intent",
    "readiness",
    "--skip-contracts",
    "--plan-json",
    "--test-path",
    "client:src/foo.test.tsx",
    "--changed",
    "packages/client/src/foo.tsx",
  ]);

  assert.equal(parsed.intent, "readiness");
  assert.equal(parsed.skipContracts, true);
  assert.equal(parsed.planJson, true);
  assert.deepEqual(parsed.testPaths.client, ["src/foo.test.tsx"]);
});
