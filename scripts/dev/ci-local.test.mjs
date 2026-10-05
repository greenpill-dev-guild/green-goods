import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import * as ciLocal from "./ci-local.js";

import { clearRepositoryLocalGitVariables, fixtureGitEnvironment } from "../lib/dev-shared.js";
import { FROZEN_ALLOWLIST } from "../quality/check-source-structure.js";
import { resolveGitInputs, selectValidation } from "../quality/select-validation.mjs";
import {
  applyCompatibilityFilters,
  arbitrumForkAvailable,
  buildLocalValidationPlan,
  capabilityRecoveryHint,
  checkEnvironment,
  executePlan,
  ignoredConfigurationFingerprint,
  isPinnedCiNodeVersion,
  isSupportedCiNodeVersion,
  loadPassingReceiptStore,
  parseArguments,
  runCommandCheck,
  savePassingReceiptStore,
  validateAttestation,
} from "./ci-local.js";

// A hook's GIT_DIR outranks `cwd`, and checks inherit this environment, so without this a check
// run against a fixture would read the repository being pushed instead.
clearRepositoryLocalGitVariables();

const GIBIBYTE = 1024 ** 3;

test("check selects explicit checks without dropping mandatory overrides", () => {
  const options = parseArguments(["--only", "lint", "--plan", "--json"]);
  assert.equal(options.intent, "diagnose");
  assert.deepEqual(options.onlyChecks, ["lint"]);
  const input = plan(["format", "lint", "contracts-test"]);
  input.checks[2].mandatory = true;
  const selected = applyCompatibilityFilters(input, options);
  assert.deepEqual(selected.checks.map((check) => check.id), ["lint", "contracts-test"]);
  assert.equal(options.planOnly, true);
  assert.equal(options.json, true);
});

test("check rejects malformed discovery and selection before execution", () => {
  for (const argv of [["--only"], ["--only", "--plan"], ["--json"], ["--list", "--only", "lint"], ["--unknown"]]) {
    assert.throws(() => parseArguments(argv));
  }
  assert.equal(parseArguments(["--list", "--json"]).list, true);
  assert.equal(parseArguments(["--only", "lint", "--intent", "release"]).intent, "release");
});

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
  // The compat re-exec must test the exact policy pin, not merely a runnable range: the
  // selector compares the toolchain exactly, so a near-pin Node blocks every check.
  assert.match(guardedEntrypoint, /pinnedCiNodeVersion\(\)/);
  assert.match(guardedEntrypoint, /isSupported: \(version\) => isPinnedCiNodeVersion\(version, pinnedNode\)/);
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
  assert.match(capabilityRecoveryHint("arbitrumFork"), /bun run --cwd packages\/contracts dev:arbitrum-fork/);
  assert.match(
    capabilityRecoveryHint("contractSubmodules", "uninitialized"),
    /git submodule update --init --recursive/,
  );
  assert.match(capabilityRecoveryHint("contractSubmodules", "modified"), /local changes/);
  assert.match(capabilityRecoveryHint("contractSubmodules", "mismatched"), /pinned gitlinks/);
  assert.match(capabilityRecoveryHint("contractSubmodules", "conflicted"), /Resolve the conflicted/);
  assert.match(capabilityRecoveryHint("contractSubmodules", "command-error"), /git submodule status/);
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
    receiptPolicy: { reuseAllowed: true },
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

test("summary distinguishes a test lease timeout from a failed test and stops the run", async () => {
  const input = plan(["shared-test", "admin-test"]);
  const calls = [];
  const execution = await executePlan(input, {
    runCheck: async (check) => { calls.push(check.id); return { ok: false, exitCode: 75 }; },
  });
  assert.equal(execution.status, "blocked");
  assert.equal(execution.exitCode, 2);
  assert.equal(execution.results[0].exitCode, 75);
  assert.deepEqual(execution.blocked, [{ id: "shared-test", blockedBy: ["test-lease"] }]);
  assert.deepEqual(calls, ["shared-test"]);
  const summary = ciLocal.summarizeExecution(input, execution, { loadAverage: [0, 0, 0], cpuCount: 4 });
  assert.equal(summary.category, "lease-timeout");
  assert.equal(summary.firstFailure, null);
  assert.deepEqual(summary.notRun, ["admin-test"]);
});

test("summary does not label another command's exit 75 as a test lease timeout", async () => {
  const input = plan(["lint"]);
  const execution = await executePlan(input, { runCheck: async () => ({ ok: false, exitCode: 75 }) });
  assert.equal(execution.status, "failed");
  assert.equal(ciLocal.summarizeExecution(input, execution).category, "check-failed");
});

test("summary retains an earlier failed check when a later suite cannot acquire its lease", async () => {
  const input = plan(["lint", "admin-test", "format"]);
  const execution = await executePlan(input, { failFast: false,
    runCheck: async (check) => ({ ok: check.id === "format", exitCode: check.id === "lint" ? 7 : check.id === "format" ? 0 : 75 }),
  });
  assert.equal(execution.status, "failed");
  assert.equal(execution.exitCode, 1);
  const summary = ciLocal.summarizeExecution(input, execution);
  assert.equal(summary.category, "check-failed");
  assert.deepEqual(summary.firstFailure, { id: "lint", exitCode: 7 });
  assert.equal(summary.context.testLease, "timed-out");
  assert.deepEqual(summary.notRun, []);
  assert.deepEqual(summary.passed, ["format"]);
});

test("summary preserves first failure, exact focused scope, skips and unrun checks without raw logs", () => {
  const input = plan(["first", "second", "third"]);
  input.testPaths = { shared: ["src/a test.ts"] };
  input.skipped = [{ id: "client-test" }];
  const execution = { status: "failed", results: [
    { id: "first", ok: false, exitCode: 7, output: "private-token", details: ["private-token"] },
    { id: "second", ok: true, exitCode: 0 },
  ], blocked: [] };
  const summary = ciLocal.summarizeExecution(input, execution);
  assert.deepEqual(summary.firstFailure, { id: "first", exitCode: 7 });
  assert.deepEqual(summary.scope.testPaths, input.testPaths);
  assert.deepEqual(summary.scope.selectedChecks, ["first", "second", "third"]);
  assert.deepEqual(summary.skipped, ["client-test"]);
  assert.deepEqual(summary.notRun, ["third"]);
  assert.equal(summary.passed.length, 1);
  assert.match(summary.nextCommand, /--plan --intent 'checkpoint'/);
  assert.match(summary.nextCommand, /--test-path 'shared:src\/a test.ts'/);
  assert.match(summary.nextCommand, /--only 'first,second,third'/);
  assert.doesNotMatch(JSON.stringify(summary), /private-token/);
});

test("summary keeps manual proof pending after an automated failure", async () => {
  const input = plan(["browser-proof", "lint"]);
  input.checks[0] = { ...input.checks[0], manual: true, command: null, advisory: true };
  const execution = await executePlan(input, { runCheck: async () => ({ ok: false, exitCode: 1 }) });
  const summary = ciLocal.summarizeExecution(input, execution);
  assert.deepEqual(summary.pendingManual, ["browser-proof"]);
  assert.equal(summary.category, "check-failed");
});

test("summary separates budget exhaustion, cancellation and unavailable capabilities", () => {
  const input = plan(["shared-test", "admin-test"]);
  for (const status of ["budget-exceeded", "cancelled"]) {
    const summary = ciLocal.summarizeExecution(input, {
      status, results: [{ id: "shared-test", ok: false, cancelled: true, exitCode: 130 }], blocked: [],
    });
    assert.equal(summary.category, status);
    assert.equal(summary.firstFailure, null);
    assert.deepEqual(summary.interrupted, ["shared-test"]);
    assert.deepEqual(summary.notRun, ["admin-test"]);
    if (status === "cancelled") assert.equal(summary.nextCommand, null);
  }
  const blocked = ciLocal.summarizeExecution(input, {
    status: "blocked", results: [], blocked: [{ id: "shared-test", blockedBy: ["dependencies"] }],
  });
  assert.equal(blocked.category, "capability-blocked");
  assert.deepEqual(blocked.blocked, [{ id: "shared-test", blockedBy: ["dependencies"] }]);
});

test("summary reports high host load only as context and separates fresh from reused proof", () => {
  const input = plan(["fresh", "cached", "failed"]);
  const summary = ciLocal.summarizeExecution(input, { status: "failed", blocked: [], results: [
    { id: "fresh", ok: true }, { id: "cached", ok: true, reused: true },
    { id: "failed", ok: false, exitCode: 1 },
  ] }, { loadAverage: [20, 10, 5], cpuCount: 4, secret: "must-not-escape" });
  assert.equal(summary.category, "check-failed");
  assert.deepEqual(summary.passed, ["fresh"]);
  assert.deepEqual(summary.reused, ["cached"]);
  assert.equal(summary.context.contentionSuspected, true);
  assert.equal(summary.context.testLease, "not-reported");
  assert.doesNotMatch(JSON.stringify(summary), /must-not-escape/);
});

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

test("a needs-focus plan starts no checks and exits non-zero", async () => {
  const calls = [];
  const input = {
    ...plan(["format", "lint"]),
    status: "needs-focus",
    stopReason: "focused-proof-required",
  };
  const result = await executePlan(input, {
    runCheck: async (check) => calls.push(check.id),
  });

  assert.equal(result.status, "needs-focus");
  assert.equal(result.exitCode, 2);
  assert.deepEqual(calls, []);
});

test("hard deadline stops noncritical work and preserves completed passing receipts", async () => {
  const receiptStore = new Map();
  const input = plan(["fast", "slow"]);
  input.requestedIntent = "push";
  input.effectiveIntent = "push";
  input.budget = {
    hardLimitSeconds: 0.03,
    enforced: true,
    estimatedWallSeconds: 0.02,
    automatedSeconds: 0.02,
    manualSeconds: 0,
  };

  const result = await executePlan(input, {
    reusePassingReceipts: true,
    receiptStore,
    runCheck: async (check, { signal }) => {
      if (check.id === "fast") return { ok: true, exitCode: 0, durationSeconds: 0.001 };
      return new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () => resolve({ ok: false, cancelled: true, exitCode: 124, durationSeconds: 0.03 }),
          { once: true },
        );
      });
    },
  });

  assert.equal(result.status, "budget-exceeded");
  assert.equal(result.exitCode, 124);
  assert.equal(receiptStore.size, 1);
  assert.equal(result.results[0].id, "fast");
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[1].id, "slow");
  assert.equal(result.results[1].ok, false);
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

test("ordinary push passes automated checks while reporting manual browser proof as pending", async () => {
  const input = plan(["format", "browser-proof"]);
  input.effectiveIntent = "push";
  input.risk = "routine";
  input.checks[1] = {
    ...input.checks[1],
    command: null,
    manual: true,
    mandatory: true,
    stopRule: "advisory",
    state: "advisory",
    blockedBy: ["authenticatedBrave"],
  };
  const calls = [];
  const result = await executePlan(input, {
    runCheck: async (check) => {
      calls.push(check.id);
      return { ok: true, exitCode: 0 };
    },
  });

  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, ["format"]);
  assert.deepEqual(result.pendingManual, [{ id: "browser-proof", blockedBy: ["authenticatedBrave"] }]);
  assert.deepEqual(result.blocked, []);
});

test("local push plan keeps the advisory browser obligation after compatibility filtering", () => {
  const options = parseArguments([
    "--intent",
    "push",
    "--test-path",
    "client:src/__tests__/routes/SessionGate.test.tsx",
  ]);
  const localPlan = buildLocalValidationPlan(
    options,
    {
      base: "base",
      head: "head",
      workingCopyFingerprint: "working-copy",
      changedPaths: ["packages/client/src/routes/SessionGate.tsx"],
      deletedPaths: [],
    },
    { profile: "test", toolchain: {}, capabilities: { dependencies: true, authenticatedBrave: false } },
  );

  assert.equal(localPlan.status, "ready");
  assert.equal(localPlan.checks.find((check) => check.id === "browser-proof")?.advisory, true);
  assert.equal(localPlan.checks.find((check) => check.id === "browser-proof")?.state, "advisory");
});

test("--attest records manual evidence per check id", () => {
  const options = parseArguments([
    "--intent",
    "release",
    "--attest",
    "browser-proof=Brave, steward session, 2026-09-22: deposit sheet renders",
  ]);
  assert.deepEqual(options.attestations, {
    "browser-proof": "Brave, steward session, 2026-09-22: deposit sheet renders",
  });
  assert.throws(() => parseArguments(["--attest", "browser-proof"]), /check-id=evidence/);
  assert.throws(() => parseArguments(["--attest", "browser-proof="]), /check-id=evidence/);
});

test("advisory manual proof never masks automated failure or unavailable capability, and only release requires attestation", async () => {
  const input = plan(["format", "browser-proof"]);
  input.effectiveIntent = "push";
  input.checks[1] = {
    ...input.checks[1],
    command: null,
    manual: true,
    mandatory: true,
    stopRule: "advisory",
    state: "advisory",
    blockedBy: ["authenticatedBrave"],
    attestation: { engines: ["authenticated Brave"] },
  };
  const failed = await executePlan(input, {
    runCheck: async () => ({ ok: false, exitCode: 7 }),
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.exitCode, 7);

  input.checks[0].state = "blocked";
  input.checks[0].blockedBy = ["dependencies"];
  const unavailable = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
  });
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.exitCode, 2);
  assert.deepEqual(unavailable.blocked, [{ id: "format", blockedBy: ["dependencies"] }]);

  input.checks[0].state = "pending";
  input.checks[0].blockedBy = [];
  input.risk = "critical";
  const critical = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
  });
  assert.equal(critical.status, "passed");
  assert.equal(critical.exitCode, 0);
  assert.deepEqual(critical.pendingManual, [{ id: "browser-proof", blockedBy: ["authenticatedBrave"] }]);

  input.risk = "routine";
  input.effectiveIntent = "release";
  const unattestedRelease = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
  });
  assert.equal(unattestedRelease.status, "blocked");
  assert.equal(unattestedRelease.exitCode, 2);
  assert.deepEqual(unattestedRelease.blocked, [
    { id: "browser-proof", blockedBy: ["manual-attestation-required"] },
  ]);

  const placeholderRelease = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
    attestations: { "browser-proof": "none" },
  });
  assert.equal(placeholderRelease.status, "blocked");
  assert.equal(placeholderRelease.exitCode, 2);
  assert.equal(placeholderRelease.blocked[0]?.id, "browser-proof");
  assert.deepEqual(placeholderRelease.blocked[0]?.blockedBy, ["manual-attestation-invalid"]);
  assert.ok((placeholderRelease.blocked[0]?.problems ?? []).length > 0);
  assert.deepEqual(placeholderRelease.results, [{ id: "format", ok: true, exitCode: 0, receiptInputs: undefined }].map(
    (entry) => ({ ...entry, receiptInputs: placeholderRelease.results[0]?.receiptInputs }),
  ));

  const evidence = "authenticated Brave, steward session, 2026-09-22: deposit sheet renders";
  const attestedRelease = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
    attestations: { "browser-proof": evidence },
  });
  assert.equal(attestedRelease.status, "passed");
  assert.equal(attestedRelease.exitCode, 0);
  const attested = attestedRelease.results.find((result) => result.id === "browser-proof");
  assert.equal(attested?.ok, true);
  assert.equal(attested?.attested, true);
  assert.deepEqual(attested?.details, [`attested: ${evidence}`]);
  assert.deepEqual(attestedRelease.pendingManual, []);
  assert.deepEqual(attestedRelease.blocked, []);

  // The same evidence on any other gate leaves the obligation pending rather than clearing it.
  for (const intent of ["push", "readiness", "ship", "merge"]) {
    input.effectiveIntent = intent;
    const nonRelease = await executePlan(input, {
      runCheck: async () => ({ ok: true, exitCode: 0 }),
      attestations: { "browser-proof": evidence },
    });
    assert.equal(nonRelease.status, "passed", intent);
    assert.deepEqual(
      nonRelease.pendingManual,
      [{ id: "browser-proof", blockedBy: ["authenticatedBrave"] }],
      intent,
    );
    assert.ok(
      !nonRelease.results.some((result) => result.id === "browser-proof"),
      `${intent} must not record an attested result`,
    );
    // The attestation is disregarded, and the run says so rather than dropping it quietly.
    assert.deepEqual(nonRelease.ignoredAttestations, [{ id: "browser-proof", intent }], intent);
  }

  // Nothing is reported when no attestation was supplied in the first place.
  input.effectiveIntent = "push";
  const withoutAttestation = await executePlan(input, {
    runCheck: async () => ({ ok: true, exitCode: 0 }),
  });
  assert.deepEqual(withoutAttestation.ignoredAttestations, []);
});

test("a toolchain mismatch never blocks a plan holding only the advisory proof", () => {
  const git = {
    base: "base",
    head: "head",
    workingCopyFingerprint: "working-copy",
    changedPaths: ["packages/client/src/sw/sw.ts"],
    deletedPaths: [],
  };
  const offPin = { node: "24.20.0", bun: "1.4.2" };
  const environment = (toolchain) => ({
    profile: "test",
    toolchain,
    capabilities: { dependencies: true, authenticatedBrave: false },
  });

  const advisoryOptions = parseArguments(["--only", "browser-proof"]);
  const advisoryOnly = applyCompatibilityFilters(
    buildLocalValidationPlan(advisoryOptions, git, environment(offPin)),
    advisoryOptions,
  );
  assert.deepEqual(
    advisoryOnly.checks.map((check) => check.id),
    ["browser-proof"],
  );
  assert.equal(advisoryOnly.status, "ready");
  assert.deepEqual(advisoryOnly.environmentBlockers, []);

  // A selection that does run a command still reports the mismatch.
  const executableOptions = parseArguments(["--only", "format"]);
  const executable = applyCompatibilityFilters(
    buildLocalValidationPlan(executableOptions, git, environment(offPin)),
    executableOptions,
  );
  assert.equal(executable.status, "blocked");
  assert.equal(executable.checks.find((check) => check.id === "format")?.state, "blocked");
});

test("a release attestation must name an accepted engine, a date, and an observation", () => {
  const check = { attestation: { engines: ["authenticated Brave"] } };

  assert.equal(
    validateAttestation(check, "authenticated Brave, steward session, 2026-09-22: deposit sheet renders").ok,
    true,
  );
  for (const placeholder of [undefined, "", "   ", "none", "n/a", "pending"]) {
    assert.equal(validateAttestation(check, placeholder).ok, false, JSON.stringify(placeholder));
  }
  assert.match(
    validateAttestation(check, "Storybook, 2026-09-22: deposit sheet renders").problems.join(" "),
    /must name the rendered engine/,
  );
  assert.match(
    validateAttestation(check, "authenticated Brave, deposit sheet renders").problems.join(" "),
    /YYYY-MM-DD/,
  );
  assert.match(
    validateAttestation(check, "authenticated Brave 2026-09-22").problems.join(" "),
    /what was observed/,
  );
  // With no declared engines the check still demands a date and an observation.
  assert.equal(validateAttestation({}, "some session, 2026-09-22: the sheet renders").ok, true);
  assert.equal(validateAttestation({}, "none").ok, false);
});

test("the gate re-execs unless the running Node is the pinned version itself", () => {
  assert.equal(isPinnedCiNodeVersion("22.22.1", "22.22.1"), true);
  assert.equal(isPinnedCiNodeVersion("22.22.0", "22.22.1"), false);
  assert.equal(isPinnedCiNodeVersion("24.20.0", "22.22.1"), false);
  // Without a readable pin it falls back to the runnable range rather than refusing to run.
  assert.equal(isPinnedCiNodeVersion("22.22.0", null), true);
  assert.equal(isPinnedCiNodeVersion("21.0.0", null), false);
});

test("post-commit push receipt reuse is exact and invalidates on tree or policy drift", async () => {
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

  const driftedPlans = [
    { ...input, head: "head-2" },
    { ...input, workingCopyFingerprint: "working-copy-2" },
    { ...input, policyVersion: 2 },
    {
      ...input,
      checks: input.checks.map((check) => ({ ...check, command: `${check.command} --changed` })),
    },
  ];
  for (const drifted of driftedPlans) {
    await executePlan(drifted, {
      reusePassingReceipts: true,
      receiptStore,
      runCheck: async () => {
        calls += 1;
        return { ok: true, exitCode: 0 };
      },
    });
  }
  assert.equal(calls, 1 + driftedPlans.length);

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

test("receipts are reused in push and never by the strict gates, at every risk", async () => {
  const runTwice = async (input) => {
    const receiptStore = new Map();
    const runs = [];
    const execute = async () => {
      let count = 0;
      const result = await executePlan(input, {
        reusePassingReceipts: true,
        receiptStore,
        runCheck: async () => {
          count += 1;
          return { ok: true, exitCode: 0 };
        },
      });
      runs.push(count);
      return result;
    };
    await execute();
    const second = await execute();
    return { runs, second, receiptStore };
  };
  const byRisk = [
    ["routine", "docs/docs/builders/quality/test-cases.mdx", {}],
    ["sensitive", "packages/agent/src/services/analytics.ts", { agent: ["src/__tests__/analytics.test.ts"] }],
    ["critical", "packages/shared/src/hooks/work/useWorkMutation.ts", { shared: ["src/hooks/work/useWorkMutation.test.ts"] }],
  ];
  for (const [risk, changedPath, testPaths] of byRisk) {
    for (const intent of ["readiness", "ship", "merge", "release"]) {
      const strict = selectValidation({ intent, changedPaths: [changedPath] });
      assert.equal(strict.risk, risk, `${intent}: ${changedPath}`);
      const { runs, second, receiptStore } = await runTwice(strict);
      assert.ok(runs[0] > 0, `${intent}: ${changedPath} ran nothing`);
      assert.deepEqual(runs, [runs[0], runs[0]], `${intent}: ${changedPath} reused a receipt`);
      assert.equal(second.results.some((result) => result.reused), false, `${intent}: ${changedPath}`);
      assert.equal(receiptStore.size, 0, `${intent}: ${changedPath}`);
    }

    const push = selectValidation({ intent: "push", changedPaths: [changedPath], testPaths });
    assert.equal(push.status, "ready", changedPath);
    const { runs, second } = await runTwice(push);
    assert.ok(runs[0] > 0, `push: ${changedPath} ran nothing`);
    assert.equal(runs[1], 0, `push: ${changedPath} reran an exact pass`);
    assert.ok(second.results.every((result) => result.reused), `push: ${changedPath}`);
  }

  // Any input, toolchain or command change is a new fingerprint and runs the check again.
  const push = selectValidation({
    intent: "push",
    changedPaths: ["packages/shared/src/hooks/work/useWorkMutation.ts"],
    testPaths: { shared: ["src/hooks/work/useWorkMutation.test.ts"] },
  });
  const store = new Map();
  let reruns = 0;
  const run = (input) =>
    executePlan(input, {
      reusePassingReceipts: true,
      receiptStore: store,
      runCheck: async () => {
        reruns += 1;
        return { ok: true, exitCode: 0 };
      },
    });
  await run(push);
  for (const drifted of [
    { ...push, head: "head-2" },
    { ...push, workingCopyFingerprint: "working-copy-2" },
    { ...push, policyVersion: push.policyVersion + 1 },
    { ...push, environment: { ...push.environment, toolchain: { node: "22.22.2" } } },
    { ...push, checks: push.checks.map((check) => ({ ...check, command: `${check.command} --x` })) },
  ]) {
    const before = reruns;
    await run(drifted);
    assert.ok(reruns > before, `a drifted plan must rerun its checks: ${JSON.stringify(Object.keys(drifted))}`);
  }

  // A plan that does not say reuse is allowed runs everything fresh.
  const unstated = { ...plan(["first"]), receiptPolicy: undefined };
  const { runs } = await runTwice(unstated);
  assert.deepEqual(runs, [1, 1]);
});

test("a receipt covers the environment a check runs with, not only the plan", async () => {
  const receiptStore = new Map();
  let runs = 0;
  const run = (environment) =>
    executePlan(plan(["shared-test"]), {
      reusePassingReceipts: true,
      receiptStore,
      environment,
      ignoredConfiguration: "sha256:config-1",
      runCheck: async () => {
        runs += 1;
        return { ok: true, exitCode: 0 };
      },
    });
  const shell = { HOME: "/home/dev", VITEST_MAX_WORKERS: "1", PATH: "/usr/bin", SHLVL: "1" };
  await run(shell);
  assert.equal((await run(shell)).results[0].reused, true);
  assert.equal(runs, 1);

  // Changing an inherited variable reruns the check, and so does a new one.
  await run({ ...shell, VITEST_MAX_WORKERS: "9" });
  await run({ ...shell, NODE_OPTIONS: "--max-old-space-size=512" });
  assert.equal(runs, 3);

  // A real `git push` through Husky's shim: git prepends its exec path, the shim sources
  // ~/.config/husky/init.sh (which commonly exports NVM_DIR) and prepends node_modules/.bin, the
  // hook prepends tool directories, two more shells count themselves, and the gate arrives through
  // a different re-exec wrapper. None of that changes a check.
  const hook = {
    ...shell,
    PATH: "node_modules/.bin:/opt/homebrew/opt/git/libexec/git-core:/Users/dev/.bun/bin:/usr/bin",
    GIT_EXEC_PATH: "/opt/homebrew/opt/git/libexec/git-core",
    NVM_DIR: "/Users/dev/.nvm",
    SHLVL: "3",
    GREEN_GOODS_NODE_CLI_COMPAT_REEXEC: "1",
    NODE: "/Users/dev/.local/share/mise/installs/node/22.22.1/bin/node",
    npm_node_execpath: "/Users/dev/.local/share/mise/installs/node/22.22.1/bin/node",
  };
  assert.equal((await run(hook)).results[0].reused, true);
  // The hook loads nvm itself under bash when a .nvmrc exists; `nvm use` then sets its own
  // variables and moves MANPATH. The pinned Node is fingerprinted as the toolchain.
  const nvmLoaded = {
    ...hook,
    NVM_BIN: "/Users/dev/.nvm/versions/node/v22.22.1/bin",
    NVM_INC: "/Users/dev/.nvm/versions/node/v22.22.1/include/node",
    NVM_CD_FLAGS: "-q",
    MANPATH: "/Users/dev/.nvm/versions/node/v22.22.1/share/man:/usr/share/man",
  };
  assert.equal((await run(nvmLoaded)).results[0].reused, true);
  assert.equal(runs, 3);

  // The store keeps a digest of the environment, never its values.
  await run({ ...shell, SECRET_TOKEN: "do-not-store-me" });
  assert.equal(JSON.stringify([...receiptStore.values()]).includes("do-not-store-me"), false);
});

test("a receipt covers the git-ignored root .env files that builds and tests read", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "validation-ignored-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "README.md"), "not configuration\n");
  const empty = ignoredConfigurationFingerprint(root);
  writeFileSync(join(root, ".env"), "VITE_CHAIN_ID=11155111\n");
  const first = ignoredConfigurationFingerprint(root);
  writeFileSync(join(root, "README.md"), "still not configuration\n");
  assert.equal(ignoredConfigurationFingerprint(root), first);
  writeFileSync(join(root, ".env"), "VITE_CHAIN_ID=42161\n");
  const edited = ignoredConfigurationFingerprint(root);
  writeFileSync(join(root, ".env.local"), "VITE_USE_HASH_ROUTER=true\n");
  const local = ignoredConfigurationFingerprint(root);
  assert.equal(new Set([empty, first, edited, local]).size, 4);

  const receiptStore = new Map();
  let runs = 0;
  const run = (ignoredConfiguration) =>
    executePlan(plan(["client-build"]), {
      reusePassingReceipts: true,
      receiptStore,
      environment: {},
      ignoredConfiguration,
      runCheck: async () => {
        runs += 1;
        return { ok: true, exitCode: 0 };
      },
    });
  await run(first);
  await run(first);
  await run(edited);
  assert.equal(runs, 2);
});

test("a changed variable reruns a real command instead of replaying its pass", async () => {
  // The probe fails only with PROBE=9. A receipt made with PROBE=1 must not stand in for it.
  const probe = plan(["probe"]);
  probe.checks[0].command = `node -e "process.exit(process.env.PROBE === '9' ? 42 : 0)"`;
  const receiptStore = new Map();
  const execute = (PROBE) =>
    executePlan(probe, {
      reusePassingReceipts: true,
      receiptStore,
      environment: { ...process.env, PROBE },
      ignoredConfiguration: "sha256:config-1",
    });
  assert.equal((await execute("1")).status, "passed");
  const changed = await execute("9");
  assert.equal(changed.status, "failed");
  assert.equal(changed.results[0].exitCode, 42);
});

test("a check finds package binaries without the caller putting node_modules/.bin on PATH", async (t) => {
  // design-guardrails calls `design.md` and fork-fixtures-test calls `vitest` by name, as package
  // scripts do. Husky's shim puts node_modules/.bin on PATH, so they passed in the hook and failed
  // with exit 127 in a manual run of the same gate.
  const packageDirectory = mkdtempSync(join(tmpdir(), "validation-package-bin-"));
  t.after(() => rmSync(packageDirectory, { recursive: true, force: true }));
  mkdirSync(join(packageDirectory, "node_modules/.bin"), { recursive: true });
  const probe = join(packageDirectory, "node_modules/.bin/gg-package-probe");
  writeFileSync(probe, "#!/bin/sh\nexit 0\n");
  chmodSync(probe, 0o755);
  const shellPath = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((entry) => !entry.includes("node_modules/.bin"))
    .join(delimiter);
  const check = { id: "package-probe", command: "gg-package-probe", cwd: packageDirectory };
  const environment = checkEnvironment(check, { ...process.env, PATH: shellPath });
  const result = await runCommandCheck(check, { captureOutput: true, environment });
  assert.equal(result.exitCode, 0);
  // Hoisted binaries live at the repository root, and the check's own directory comes first.
  const entries = environment.PATH.split(delimiter);
  assert.equal(entries[0], join(packageDirectory, "node_modules/.bin"));
  assert.ok(entries.includes(join(dirname(dirname(import.meta.dirname)), "node_modules/.bin")));
});

test("the immutable report check judges the range its plan compared", async () => {
  // CI hands the check the push's previous head or the pull request's base. Locally the check fell
  // back to origin/develop, which a pull request into another branch does not compare against, so
  // the gate passes the base its own plan used. An explicit base still wins, and no other check
  // receives the variable.
  const seen = {};
  const runCheck = async (check, { environment }) => {
    seen[check.id] = environment;
    return { ok: true, exitCode: 0, durationSeconds: 0.01 };
  };
  const input = plan(["immutable-plan-reports", "test-quality"]);
  await executePlan(input, { runCheck, environment: {} });
  assert.equal(seen["immutable-plan-reports"].PLAN_REPORTS_BASE_REF, input.base);
  assert.equal(seen["test-quality"].PLAN_REPORTS_BASE_REF, undefined);

  for (const explicit of [{ PLAN_REPORTS_BASE_REF: "origin/main" }, { GUIDANCE_BASE_REF: "origin/main" }]) {
    await executePlan(input, { runCheck, environment: explicit });
    assert.equal(seen["immutable-plan-reports"].PLAN_REPORTS_BASE_REF, explicit.PLAN_REPORTS_BASE_REF);
    assert.equal(seen["immutable-plan-reports"].GUIDANCE_BASE_REF, explicit.GUIDANCE_BASE_REF);
  }
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

test("ci-local keeps deleted and moved paths out of the scoped format and lint commands", () => {
  // A hub promotion moves .plans/backlog/<slug>/ to .plans/active/<slug>/; git
  // reports the old paths as deleted, and Biome fails on a file it cannot open.
  const options = parseArguments(["--intent", "push"]);
  const localPlan = buildLocalValidationPlan(
    options,
    {
      base: "base",
      head: "head",
      workingCopyFingerprint: "move-fingerprint",
      changedPaths: [
        ".plans/active/example/plan.todo.md",
        ".plans/backlog/example/plan.todo.md",
        "packages/client/src/components/Panel.tsx",
      ],
      deletedPaths: [".plans/backlog/example/plan.todo.md"],
    },
    { profile: "test", toolchain: {}, capabilities: {} },
  );

  const format = localPlan.checks.find((check) => check.id === "format");
  assert.ok(format, "push plan selects format");
  assert.equal(format.command.includes(".plans/backlog/example/plan.todo.md"), false);
  assert.equal(format.command.includes(".plans/active/example/plan.todo.md"), true);
  const lint = localPlan.checks.find((check) => check.id === "lint");
  assert.ok(lint, "push plan selects lint");
  assert.equal(lint.command.includes(".plans/backlog/example/plan.todo.md"), false);
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

// The structure checker finds its repository from its own location, so a fixture carries copies.
const STRUCTURE_CHECKER_FILES = [
  "scripts/quality/check-source-structure.js",
  "scripts/quality/check-staged-modules.mjs",
  "scripts/lib/git-guardrails.mjs",
];

function writeFixtureFile(root, path, contents) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), contents);
}

// A distinct name per file keeps git from pairing one fixture file with another in a move.
function sourceLines(count, name = "line") {
  return Array.from({ length: count }, (_, index) => `const ${name}${index} = ${index};\n`).join("");
}

// A repository holding a copy of the structure checker plus `files`, committed as the base.
function structureFixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), "push-gate-structure-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const environment = fixtureGitEnvironment();
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      env: environment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  for (const path of STRUCTURE_CHECKER_FILES) {
    writeFixtureFile(root, path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
  }
  writeFixtureFile(root, "package.json", '{ "type": "module" }\n');
  writeFixtureFile(root, "packages/shared/package.json", '{ "exports": { ".": "./src/index.ts" } }\n');
  for (const [path, contents] of Object.entries(files)) writeFixtureFile(root, path, contents);
  git("init");
  git("add", ".");
  git("commit", "-m", "seed the base");
  return { root, git, base: git("rev-parse", "HEAD") };
}

// Runs the push plan's own structure command inside the fixture, as the gate would.
async function runPushStructureCheck(root, base) {
  const options = parseArguments(["--intent", "push", "--base", base]);
  const pushPlan = buildLocalValidationPlan(options, resolveGitInputs(options, { cwd: root }), {
    profile: "test",
    toolchain: {},
    capabilities: {},
  });
  const structure = pushPlan.checks.find((check) => check.id === "source-structure");
  assert.ok(structure, "changed package source selects the structure check");
  // An absolute cwd runs the plan's command inside the fixture.
  return runCommandCheck({ ...structure, cwd: root }, { captureOutput: true });
}

test("the push gate fails structure violations in committed work, not only uncommitted work", async (t) => {
  const path = "packages/shared/src/config/query-persistence.ts";
  const { root, git, base } = structureFixture(t, { [path]: sourceLines(480) });
  // Committed, so the working tree no longer shows it; CI judges it against the base (PR #898).
  writeFixtureFile(root, path, sourceLines(513));
  git("commit", "-am", "grow the reading cache past the modified-file cap");
  // Not committed yet, so only the working tree shows it.
  writeFixtureFile(root, "packages/shared/src/config/query-snapshot.ts", sourceLines(351));

  const result = await runPushStructureCheck(root, base);

  assert.equal(result.exitCode, 1, result.output);
  assert.match(result.output, /query-persistence\.ts: modified file at 513 lines/);
  assert.match(result.output, /query-snapshot\.ts: new file at 351 lines/);
});

test("the push gate judges a moved file at its new path as a modified file", async (t) => {
  // Take a real frozen ceiling so the fixture follows the checker's own list.
  const [allowlisted, ceiling] = Object.entries(FROZEN_ALLOWLIST).find(([path]) =>
    path.startsWith("packages/shared/src/utils/"),
  );
  const utilities = "packages/shared/src/utils";
  const { root, git, base } = structureFixture(t, {
    [`${utilities}/growing.ts`]: sourceLines(480, "growing"),
    [`${utilities}/steady.ts`]: sourceLines(400, "steady"),
    [allowlisted]: sourceLines(ceiling, "frozen"),
  });
  const move = (from, to, contents) => {
    git("mv", from, to);
    writeFixtureFile(root, to, contents);
  };
  // Moved and grown past the modified-file cap in one commit: CI's rename detection reports R.
  move(`${utilities}/growing.ts`, `${utilities}/grown.ts`, sourceLines(513, "growing"));
  // Moved unchanged: longer than the new-file cap allows, but not a new file.
  move(`${utilities}/steady.ts`, `${utilities}/settled.ts`, sourceLines(400, "steady"));
  // Moved unchanged, while its frozen ceiling stays keyed to the old path.
  move(allowlisted, `${utilities}/relocated.ts`, sourceLines(ceiling, "frozen"));
  git("commit", "-am", "move three utilities");

  const result = await runPushStructureCheck(root, base);

  assert.equal(result.exitCode, 1, result.output);
  assert.match(result.output, /grown\.ts: modified file at 513 lines/);
  assert.ok(
    result.output.includes(`relocated.ts: ${ceiling} lines, moved from ${allowlisted}`),
    result.output,
  );
  assert.doesNotMatch(result.output, /settled\.ts/);
});

test("package suites in a real plan run one at a time, leaving worker sizing to the test lease", async () => {
  // A checkpoint on a Shared utility selects Shared, Client, Admin and Agent suites back to back.
  const input = selectValidation({
    intent: "checkpoint",
    changedPaths: ["packages/shared/src/utils/time.ts"],
  });
  const suites = input.checks.filter((check) => check.id.endsWith("-test")).map((check) => check.id);
  assert.deepEqual(suites, ["shared-test", "client-test", "admin-test", "agent-test"]);

  const state = { active: 0, peak: 0, order: [], options: [] };
  const result = await executePlan(input, {
    runCheck: async (check, options = {}) => {
      state.order.push(check.id);
      state.options.push(options);
      state.active += 1;
      state.peak = Math.max(state.peak, state.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.active -= 1;
      return { ok: true, exitCode: 0, durationSeconds: 0.01 };
    },
  });
  assert.equal(result.status, "passed");
  assert.equal(state.peak, 1);
  assert.deepEqual(state.order, input.checks.map((check) => check.id));
  // Each suite gets the environment its receipt fingerprints, and the runner sizes no workers.
  assert.ok(
    state.options.every(
      (options) =>
        options.environment.VITEST_MAX_WORKERS === process.env.VITEST_MAX_WORKERS && !options.captureOutput,
    ),
  );
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
    {
      id: "format",
      state: "pending",
      mandatory: false,
      budgetSeconds: 5,
      command: "bunx @biomejs/biome format",
    },
  ]);
  plan.environmentBlockers = ["toolchain.bun"];

  assert.equal(applyCompatibilityFilters(plan, {}).status, "blocked");
});

test("a toolchain blocker only a dropped check needed stops blocking the plan", () => {
  // `bun run check --only design-tokens` on a runner without Foundry: the
  // toolchain comparison upstream sees contracts-test and blocks everything,
  // but the surviving check is a shell script that never touches Foundry.
  const plan = filterablePlan([
    {
      id: "design-tokens",
      state: "blocked",
      blockedBy: ["toolchain.foundry"],
      mandatory: false,
      budgetSeconds: 60,
      command: "bash scripts/design/check-tokens.sh",
      capabilities: ["dependencies"],
    },
    {
      id: "contracts-test",
      state: "blocked",
      blockedBy: ["toolchain.foundry"],
      mandatory: false,
      budgetSeconds: 60,
      capabilities: ["foundry"],
    },
  ]);
  plan.environmentBlockers = [{ capability: "toolchain.foundry", expected: "1.0.0", actual: null }];

  const filtered = applyCompatibilityFilters(plan, { onlyChecks: ["design-tokens"] });

  assert.deepEqual(
    filtered.checks.map((check) => check.id),
    ["design-tokens"],
  );
  assert.deepEqual(filtered.checks[0].blockedBy, []);
  assert.equal(filtered.checks[0].state, "pending");
  assert.deepEqual(filtered.environmentBlockers, []);
  assert.equal(filtered.status, "ready");
});

test("a toolchain blocker a surviving check still needs keeps the plan blocked", () => {
  const plan = filterablePlan([
    {
      id: "contracts-test",
      state: "blocked",
      blockedBy: ["toolchain.foundry"],
      mandatory: false,
      budgetSeconds: 60,
      capabilities: ["foundry"],
    },
    {
      id: "indexer-test",
      state: "blocked",
      blockedBy: ["toolchain.foundry"],
      mandatory: false,
      budgetSeconds: 60,
    },
  ]);
  plan.environmentBlockers = [{ capability: "toolchain.foundry", expected: "1.0.0", actual: null }];

  const filtered = applyCompatibilityFilters(plan, { skipIndexer: true });

  assert.equal(filtered.checks[0].state, "blocked");
  assert.equal(filtered.status, "blocked");
});

test("local gate checks mark themselves so package suites still take the machine test lease", async () => {
  const result = await runCommandCheck(
    {
      id: "shared-test",
      command: `node -e "process.stdout.write([process.env.CI, process.env.GREEN_GOODS_LOCAL_GATE].join(' '))"`,
      cwd: ".",
    },
    { captureOutput: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.output, "true 1");
});
