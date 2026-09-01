import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  applyCompatibilityFilters,
  arbitrumForkAvailable,
  buildLocalValidationPlan,
  capabilityRecoveryHint,
  executePlan,
  isSupportedCiNodeVersion,
  loadPassingReceiptStore,
  parseArguments,
  resolveVitestBatchEnvironment,
  savePassingReceiptStore,
} from "./ci-local.js";

const GIBIBYTE = 1024 ** 3;

test("ci-local re-entry is wired only inside the direct-run guard", () => {
  const source = readFileSync(new URL("./ci-local.js", import.meta.url), "utf8");
  const directRunGuard = source.indexOf("if (isDirectRun) {");
  assert.notEqual(directRunGuard, -1);

  const beforeGuard = source.slice(0, directRunGuard);
  const guardedEntrypoint = source.slice(directRunGuard);
  assert.doesNotMatch(beforeGuard, /reexecUnder(?:System|Compatible)NodeIfNeeded\(\{/);
  assert.match(guardedEntrypoint, /reexecUnderSystemNodeIfNeeded\(\{/);
  assert.match(guardedEntrypoint, /GREEN_GOODS_CI_LOCAL_NODE_REEXEC/);
  assert.match(guardedEntrypoint, /reexecUnderCompatibleNodeIfNeeded\(\{/);
  assert.match(guardedEntrypoint, /GREEN_GOODS_CI_LOCAL_COMPAT_REEXEC/);
  assert.match(guardedEntrypoint, /isSupported: isSupportedCiNodeVersion/);
});

test("ci-local compatibility accepts Node 22 and newer", () => {
  assert.equal(isSupportedCiNodeVersion("21.99.0"), false);
  assert.equal(isSupportedCiNodeVersion("22.0.0"), true);
  assert.equal(isSupportedCiNodeVersion("23.1.0"), true);
  assert.equal(isSupportedCiNodeVersion("invalid"), false);
});

test("ci-local detects the Arbitrum fork from an RPC override or port probe", async () => {
  let probes = 0;
  assert.equal(
    await arbitrumForkAvailable({
      rpcUrl: "https://rpc.example",
      probe: async () => {
        probes += 1;
        return false;
      },
    }),
    true,
  );
  assert.equal(probes, 0);

  assert.equal(
    await arbitrumForkAvailable({
      rpcUrl: "",
      probe: async ({ host, port }) => {
        probes += 1;
        assert.equal(host, "127.0.0.1");
        assert.equal(port, 3009);
        return true;
      },
    }),
    true,
  );
  assert.equal(probes, 1);
});

test("environment blockers name their recovery commands", () => {
  assert.match(capabilityRecoveryHint("arbitrumFork"), /bun run dev:contracts:arbitrum-fork/);
  assert.match(
    capabilityRecoveryHint("contractSubmodules"),
    /git submodule update --init --recursive/,
  );
  assert.equal(capabilityRecoveryHint("docker"), null);
});

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

test("a fully blocked plan runs zero checks and exits non-zero", async () => {
  const input = plan(["format", "shared-test"], "blocked");
  for (const check of input.checks) {
    check.state = "blocked";
    check.blockedBy = ["toolchain.node", "toolchain.bun"];
  }
  const calls = [];
  const result = await executePlan(input, {
    runCheck: async (check) => {
      calls.push(check.id);
      return { ok: true, exitCode: 0 };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.exitCode, 2);
  assert.deepEqual(calls, []);
  assert.deepEqual(result.results, []);
  assert.equal(result.blocked.length, 2);
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
    "--checkpoint-scope",
    "lane",
    "--intent",
    "checkpoint",
    "--skip-contracts",
    "--plan-json",
    "--test-path",
    "client:src/foo.test.tsx",
    "--changed",
    "packages/client/src/foo.tsx",
  ]);

  assert.equal(parsed.intent, "checkpoint");
  assert.equal(parsed.checkpointScope, "lane");
  assert.equal(parsed.skipContracts, true);
  assert.equal(parsed.planJson, true);
  assert.deepEqual(parsed.testPaths.client, ["src/foo.test.tsx"]);
});

test("ci-local rejects a lane checkpoint without explicit changed paths", () => {
  assert.throws(
    () => parseArguments(["--quick", "--checkpoint-scope", "lane"]),
    /lane checkpoint requires --changed/i,
  );
});

test("ci-local passes explicit lane checkpoint scope into the selector", () => {
  const options = parseArguments([
    "--quick",
    "--checkpoint-scope",
    "lane",
    "--changed",
    "packages/client/src/components/Panel.tsx",
  ]);
  const localPlan = buildLocalValidationPlan(
    options,
    {
      base: "base",
      head: "head",
      workingCopyFingerprint: "lane-fingerprint",
      changedPaths: options.changedPaths,
    },
    { profile: "test", toolchain: {}, capabilities: {} },
  );

  assert.equal(localPlan.checkpointScope, "lane");
  assert.equal(
    localPlan.checks.find((check) => check.id === "format").command,
    "bunx @biomejs/biome format --no-errors-on-unmatched 'packages/client/src/components/Panel.tsx'",
  );
  assert.equal(
    localPlan.checks.find((check) => check.id === "lint").command,
    "bun --bun run oxlint 'packages/client/src/components/Panel.tsx' --deny-warnings",
  );
});

// Independent package suites declare a concurrency group in the policy. Only
// checks adjacent in plan order may batch, so printed order and the stop rule
// survive untouched.
function groupedPlan(specs) {
  const base = plan(specs.map((spec) => spec.id));
  base.checks = base.checks.map((check, index) => ({
    ...check,
    ...(specs[index].group ? { concurrencyGroup: specs[index].group } : {}),
    ...(specs[index].blocked ? { state: "blocked", blockedBy: ["toolchain.node"] } : {}),
  }));
  return base;
}

function overlapTracker() {
  const state = {
    active: 0,
    peak: 0,
    captured: new Map(),
    environments: new Map(),
    order: [],
  };
  const runCheck = async (check, options = {}) => {
    state.order.push(check.id);
    state.captured.set(check.id, options.captureOutput === true);
    state.environments.set(check.id, options.environment);
    state.active += 1;
    state.peak = Math.max(state.peak, state.active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    state.active -= 1;
    return { ok: true, exitCode: 0, durationSeconds: 0.01 };
  };
  return { state, runCheck };
}

test("adjacent checks sharing a concurrency group run together", async () => {
  const { state, runCheck } = overlapTracker();
  const result = await executePlan(
    groupedPlan([
      { id: "client-test", group: "package-tests-surface" },
      { id: "admin-test", group: "package-tests-surface" },
    ]),
    { runCheck },
  );

  assert.equal(result.status, "passed");
  assert.equal(state.peak, 2);
  assert.equal(state.captured.get("client-test"), true);
  assert.equal(state.captured.get("admin-test"), true);
});

test("batched package tests receive a worker cap divided by batch size", () => {
  const environment = resolveVitestBatchEnvironment(
    [
      { id: "client-test" },
      { id: "admin-test" },
    ],
    {
      cpus: 10,
      totalMemoryBytes: 16 * GIBIBYTE,
      ci: false,
    },
  );

  assert.deepEqual(environment, { VITEST_MAX_WORKERS: "4" });
});

test("batched worker environment leaves CI unchanged and preserves explicit overrides", () => {
  const batch = [{ id: "client-test" }, { id: "admin-test" }];
  const resources = {
    cpus: 10,
    totalMemoryBytes: 16 * GIBIBYTE,
    ci: true,
  };

  assert.deepEqual(resolveVitestBatchEnvironment(batch, resources), {});
  assert.deepEqual(
    resolveVitestBatchEnvironment(batch, {
      ...resources,
      explicitMaxWorkers: "3",
    }),
    { VITEST_MAX_WORKERS: "3" },
  );
});

test("every member of a concurrent test batch receives the resolved worker environment", async () => {
  const { state, runCheck } = overlapTracker();
  await executePlan(
    groupedPlan([
      { id: "client-test", group: "package-tests-surface" },
      { id: "admin-test", group: "package-tests-surface" },
    ]),
    {
      runCheck,
      resolveBatchEnvironment: () => ({ VITEST_MAX_WORKERS: "2" }),
    },
  );

  assert.deepEqual(state.environments.get("client-test"), {
    VITEST_MAX_WORKERS: "2",
  });
  assert.deepEqual(state.environments.get("admin-test"), {
    VITEST_MAX_WORKERS: "2",
  });
});

test("different groups, ungrouped checks, and blocked members never batch", async () => {
  for (const specs of [
    [
      { id: "shared-test", group: "package-tests-core" },
      { id: "client-test", group: "package-tests-surface" },
    ],
    [{ id: "format" }, { id: "client-test", group: "package-tests-surface" }],
    [
      { id: "client-test", group: "package-tests-surface" },
      { id: "admin-test", group: "package-tests-surface", blocked: true },
    ],
  ]) {
    const { state, runCheck } = overlapTracker();
    await executePlan(groupedPlan(specs), { runCheck });
    assert.equal(state.peak, 1, JSON.stringify(specs));
  }
});

test("a check running alone still streams instead of capturing", async () => {
  const { state, runCheck } = overlapTracker();
  await executePlan(groupedPlan([{ id: "format" }]), { runCheck });
  assert.equal(state.captured.get("format"), false);
});

test("a failing batch reports every member and stops the checks after it", async () => {
  const started = [];
  const result = await executePlan(
    groupedPlan([
      { id: "client-test", group: "package-tests-surface" },
      { id: "admin-test", group: "package-tests-surface" },
      { id: "docs-build" },
    ]),
    {
      runCheck: async (check) => {
        started.push(check.id);
        const ok = check.id !== "client-test";
        return { ok, exitCode: ok ? 0 : 3, durationSeconds: 0.01 };
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 3);
  // both in-flight members report, and nothing after the batch starts
  assert.deepEqual([...started].sort(), ["admin-test", "client-test"]);
  assert.deepEqual(
    result.results.map((entry) => entry.id),
    ["client-test", "admin-test"],
  );
});

test("concurrency can be turned off without changing results", async () => {
  const { state, runCheck } = overlapTracker();
  const result = await executePlan(
    groupedPlan([
      { id: "client-test", group: "package-tests-surface" },
      { id: "admin-test", group: "package-tests-surface" },
    ]),
    { runCheck, concurrency: false },
  );

  assert.equal(result.status, "passed");
  assert.equal(state.peak, 1);
  assert.deepEqual(state.order, ["client-test", "admin-test"]);
});

test("a reusable receipt keeps its member out of the batch", async () => {
  const receiptStore = new Map();
  const grouped = groupedPlan([
    { id: "client-test", group: "package-tests-surface" },
    { id: "admin-test", group: "package-tests-surface" },
  ]);

  await executePlan(grouped, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async () => ({ ok: true, exitCode: 0, durationSeconds: 0.01 }),
  });

  const { state, runCheck } = overlapTracker();
  const second = await executePlan(grouped, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck,
  });

  assert.equal(second.status, "passed");
  assert.equal(state.peak, 0);
  assert.ok(second.results.every((entry) => entry.reused === true));
});

// Regression: the plan inherited its blocked status even after the compatibility
// filter removed the only blocked check, so a run whose remaining checks all
// passed still reported blocked and exited 2.
function filterablePlan(checks) {
  return {
    status: checks.some((c) => c.state === "blocked") ? "blocked" : "ready",
    environmentBlockers: [],
    budget: { targetSeconds: 180, automatedSeconds: 0, manualSeconds: 0 },
    checks,
  };
}

test("dropping the only blocked check unblocks the plan", () => {
  const plan = filterablePlan([
    { id: "format", state: "pending", mandatory: false, budgetSeconds: 5 },
    { id: "indexer-test", state: "blocked", mandatory: false, budgetSeconds: 60 },
  ]);
  assert.equal(plan.status, "blocked");

  const filtered = applyCompatibilityFilters(plan, { skipIndexer: true });

  assert.deepEqual(
    filtered.checks.map((check) => check.id),
    ["format"],
  );
  assert.equal(filtered.status, "ready");
});

test("a blocked check that survives the filter keeps the plan blocked", () => {
  const plan = filterablePlan([
    { id: "format", state: "pending", mandatory: false, budgetSeconds: 5 },
    { id: "indexer-test", state: "blocked", mandatory: false, budgetSeconds: 60 },
  ]);

  const filtered = applyCompatibilityFilters(plan, { skipDocs: true });

  assert.equal(filtered.status, "blocked");
});

test("a mandatory blocked check is never dropped by a compatibility filter", () => {
  const plan = filterablePlan([
    { id: "indexer-test", state: "blocked", mandatory: true, budgetSeconds: 60 },
  ]);

  const filtered = applyCompatibilityFilters(plan, { skipIndexer: true });

  assert.deepEqual(
    filtered.checks.map((check) => check.id),
    ["indexer-test"],
  );
  assert.equal(filtered.status, "blocked");
});

test("environment blockers keep the plan blocked even with no blocked checks", () => {
  const plan = filterablePlan([
    { id: "format", state: "pending", mandatory: false, budgetSeconds: 5 },
  ]);
  plan.environmentBlockers = ["toolchain.bun"];

  assert.equal(applyCompatibilityFilters(plan, {}).status, "blocked");
});
