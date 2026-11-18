/** @direct-test-command ./coverage-policy.mjs */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const POLICY = path.join(path.dirname(fileURLToPath(import.meta.url)), "coverage-policy.mjs");

// `log` stands for the log of a forge coverage command that failed; the runner passes none otherwise.
function runPolicy({ localOk, lcov = "", log, localError = localOk ? "" : "Local coverage command failed or timed out." }) {
  const dir = mkdtempSync(path.join(tmpdir(), "coverage-policy-"));
  try {
    const file = (name) => path.join(dir, name);
    writeFileSync(file("lcov.info"), lcov);
    if (log !== undefined) writeFileSync(file("coverage-local.log"), log);
    const result = spawnSync(
      process.execPath,
      [
        POLICY,
        ...["--local-lcov", file("lcov.info"), "--failed-command-log", log === undefined ? "" : file("coverage-local.log")],
        ...["--summary-md", file("summary.md"), "--summary-json", file("summary.json")],
        ...["--local-ok", String(localOk), "--local-error", localError],
      ],
      { encoding: "utf8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      md: readFileSync(file("summary.md"), "utf8"),
      json: JSON.parse(readFileSync(file("summary.json"), "utf8")),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertNamedFailure(result, reason) {
  assert.equal(result.status, 1);
  assert.ok(result.stdout.endsWith(`Coverage failure: ${reason}\nCoverage status: FAIL\n`), result.stdout);
  assert.ok(result.md.includes(`- Reason: ${reason}\n`));
  assert.equal(result.json.raw.local.failure_reason, reason);
  // Unmeasured gates must not read as 100% coverage.
  assert.ok(!result.md.includes("(0/0)"));
  assert.match(result.md, /\| not measured \| not measured \| line >= 80%, branch >= 65% \| FAIL \|/);
}

function assertFailureNamed(logLines, reason) {
  assertNamedFailure(runPolicy({ localOk: false, log: logLines.join("\n") }), reason);
}

// Log shapes come from real runs: the stack-too-deep build is Coverage Nightly run 43757620707,
// the failing-test summary is Contracts Nightly run 43706250118.
test("a coverage build that does not compile names the compiler error", () => {
  assertFailureNamed(
    [
      "Compiling 578 files with Solc 0.8.28",
      "Solc 0.8.28 finished in 292.26s",
      "Error: Compiler run failed:",
      "Error: Yul exception:Variable _28 is 1 too deep in the stack [ _28 var_j var_artifact_mpos RET ]",
      "memoryguard was present.",
    ],
    "the coverage build did not compile: Yul exception:Variable _28 is 1 too deep in the stack [ _28 var_j var_artifact_mpos RET ]",
  );
});

test("a compile error with a source location names the file and line", () => {
  assertFailureNamed(
    ["Error: Compiler run failed:", "Error (2314): Expected ';' but got '}'", " --> test/unit/Broken.t.sol:12:5:", "   |"],
    "the coverage build did not compile: Error (2314): Expected ';' but got '}' at test/unit/Broken.t.sol:12:5",
  );
});

test("tests that fail under coverage are each named once, by suite", () => {
  assertFailureNamed(
    [
      "Ran 3 tests for test/unit/VoucherEntitlement.t.sol:VoucherEntitlementTest",
      "[FAIL] testVoucherEntitlement_upgradeCannotChangeLocalChainIdentity() (gas: 4170806)",
      "",
      "Failing tests:",
      "Encountered 1 failing test in test/unit/VoucherEntitlement.t.sol:VoucherEntitlementTest",
      "[FAIL] testVoucherEntitlement_upgradeCannotChangeLocalChainIdentity() (gas: 4170806)",
      "",
      "Encountered 2 failing tests in test/integration/PersonalServicePurchase.t.sol:PersonalServicePurchaseTest",
      "[FAIL: CommitmentFundingNotInState(3, 1)] testConsumeWithoutDeposit() (gas: 91200)",
      "[FAIL: assertion failed: [1, 2] != [1]; counterexample: calldata=0x01 args=[7]] testFuzz_deposit(uint256) (runs: 3, μ: 1, ~: 1)",
      "",
      "Encountered a total of 3 failing tests, 2251 tests succeeded",
    ],
    "3 tests failed under coverage: VoucherEntitlementTest.testVoucherEntitlement_upgradeCannotChangeLocalChainIdentity, " +
      "PersonalServicePurchaseTest.testConsumeWithoutDeposit, PersonalServicePurchaseTest.testFuzz_deposit",
  );
});

test("a run the audit's timeout stopped names the timeout", () => {
  assertFailureNamed(["Compiling 578 files with Solc 0.8.28", "TIMEOUT after 5100s"], "forge coverage timed out after 5100s");
});

test("a kill the audit's watchdog did not send is not reported as a timeout", () => {
  assertFailureNamed(
    ["Compiling 578 files with Solc 0.8.28", "KILLED by signal (exit 137) before the 5100s timeout"],
    "forge coverage was killed by a signal (exit 137) before the audit's timeout; an out-of-memory kill looks like this",
  );
});

test("a clean forge run that wrote no LCOV keeps the runner's own error", () => {
  const localError = "Expected lcov.info after local coverage run";
  assertNamedFailure(runPolicy({ localOk: false, localError }), localError);
});

test("a log with no known failure pattern quotes its last line", () => {
  assertFailureNamed(
    ["Compiling 578 files with Solc 0.8.28", "Error: failed to write lcov report"],
    "no known failure pattern in the coverage log; it ends: Error: failed to write lcov report",
  );
});

const CRITICAL_FILES = Object.keys(runPolicy({ localOk: true }).json.thresholds.critical_contracts);

// Every critical file fully covered, except any listed with its own extra LCOV lines.
function criticalLcov(extra = {}) {
  return CRITICAL_FILES.map(
    (file) => `SF:/repo/packages/contracts/${file}\nDA:1,1\nBRDA:1,0,0,1\n${extra[file] ?? ""}end_of_record`,
  ).join("\n");
}

test("a passing coverage run prints no failure reason", () => {
  const result = runPolicy({ localOk: true, lcov: criticalLcov() });

  assert.equal(result.status, 0);
  assert.ok(!result.stdout.includes("Coverage failure"));
  assert.ok(!result.md.includes("Reason:"));
  assert.equal(result.json.raw.local.failure_reason, "");
  const total = CRITICAL_FILES.length;
  assert.match(result.md, new RegExp(`\\| 100\\.00% \\(${total}/${total}\\) \\|`));
});

test("a run below a floor names the gate and the measure it missed", () => {
  const file = "src/lib/Settlement/PersonalFundingLib.sol";
  const result = runPolicy({ localOk: true, lcov: criticalLcov({ [file]: "BRDA:2,0,0,0\n" }) });

  const reason = `below floor: ${file} branch 50.00% < 60%`;
  assert.equal(result.status, 1);
  assert.ok(result.stdout.endsWith(`Coverage failure: ${reason}\nCoverage status: FAIL\n`), result.stdout);
  assert.ok(result.md.includes(`- Reason: ${reason}\n`));
});
