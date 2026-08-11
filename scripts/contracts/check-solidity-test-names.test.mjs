import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  addedTestFunctionsFromDiff,
  isCanonicalSolidityTestName,
  testFunctionsFromSource,
} from "./check-solidity-test-names.mjs";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-solidity-test-names.mjs",
);

test("accepts each canonical Solidity test category", () => {
  for (const name of [
    "testCreditRegistry_revertsWhenPaused",
    "testFuzz_CreditRegistry_preservesCap",
    "testIntegration_Settlement_confirmsLoan",
    "testUpgrade_CreditRegistry_preservesStorage",
    "testE2E_CommitmentCredit_settlesLoan",
    "invariant_CreditRegistry_reservationsNeverExceedCap",
  ]) {
    assert.equal(isCanonicalSolidityTestName(name), true, name);
  }
});

test("rejects newly introduced legacy and sentence-style names", () => {
  for (const name of [
    "testApprovalGatedFreeOfferRechecksClaimantMembership",
    "testRevert_CreditRegistryPaused",
    "testRevert_revertsWhenPaused",
    "test_credit_registry",
  ]) {
    assert.equal(isCanonicalSolidityTestName(name), false, name);
  }
});

test("extracts only added or renamed function declarations", () => {
  const diff = [
    "+++ b/packages/contracts/test/unit/Credit.t.sol",
    "@@ -10,2 +10,3 @@",
    " function testLegacyName() public {}",
    "+function testCreditRegistry_revertsWhenPaused() public {}",
    "-function testOldName() public {}",
    "+function testNewSentenceName() public {}",
  ].join("\n");
  assert.deepEqual(addedTestFunctionsFromDiff(diff), [
    {
      file: "packages/contracts/test/unit/Credit.t.sol",
      line: 11,
      name: "testCreditRegistry_revertsWhenPaused",
    },
    {
      file: "packages/contracts/test/unit/Credit.t.sol",
      line: 12,
      name: "testNewSentenceName",
    },
  ]);
});

test("does not count Git no-newline markers as source lines", () => {
  const diff = [
    "+++ b/packages/contracts/test/unit/Credit.t.sol",
    "@@ -10,1 +10,2 @@",
    "+function testCreditRegistry_firstScenario() public {}",
    "\\ No newline at end of file",
    "+function testCreditRegistry_secondScenario() public {}",
  ].join("\n");
  assert.deepEqual(
    addedTestFunctionsFromDiff(diff).map(({ line, name }) => ({ line, name })),
    [
      { line: 10, name: "testCreditRegistry_firstScenario" },
      { line: 11, name: "testCreditRegistry_secondScenario" },
    ],
  );
});

test("extracts added and renamed declarations across line breaks", () => {
  const diff = [
    "+++ b/packages/contracts/test/unit/Credit.t.sol",
    "@@ -10,3 +10,3 @@",
    " function",
    "-  testOldSentenceName",
    "+  testNewSentenceName",
    " (",
    "@@ -20,0 +20,3 @@",
    "+function",
    "+  testCreditRegistry_revertsWhenPaused",
    "+(",
  ].join("\n");
  assert.deepEqual(addedTestFunctionsFromDiff(diff), [
    {
      file: "packages/contracts/test/unit/Credit.t.sol",
      line: 11,
      name: "testNewSentenceName",
    },
    {
      file: "packages/contracts/test/unit/Credit.t.sol",
      line: 21,
      name: "testCreditRegistry_revertsWhenPaused",
    },
  ]);
});

test("extracts test declarations from an untracked Solidity source", () => {
  const source = [
    "contract CreditTest {",
    "  function helper() internal {}",
    "  function testCreditRegistry_revertsWhenPaused() public {}",
    "  function invariant_CreditRegistry_reservationsNeverExceedCap() public {}",
    "}",
  ].join("\n");
  assert.deepEqual(testFunctionsFromSource(source, "packages/contracts/test/Credit.t.sol"), [
    {
      file: "packages/contracts/test/Credit.t.sol",
      line: 3,
      name: "testCreditRegistry_revertsWhenPaused",
    },
    {
      file: "packages/contracts/test/Credit.t.sol",
      line: 4,
      name: "invariant_CreditRegistry_reservationsNeverExceedCap",
    },
  ]);
});

test("extracts multiline declarations from untracked Solidity source", () => {
  const source = [
    "contract CreditTest {",
    "  function",
    "    testCreditRegistry_revertsWhenPaused",
    "  (",
    "  ) public {}",
    "}",
  ].join("\n");
  assert.deepEqual(testFunctionsFromSource(source, "packages/contracts/test/Credit.t.sol"), [
    {
      file: "packages/contracts/test/Credit.t.sol",
      line: 3,
      name: "testCreditRegistry_revertsWhenPaused",
    },
  ]);
});

test("rejects unknown CLI arguments", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});

test("rejects --base without a value", () => {
  const result = spawnSync(process.execPath, [script, "--base"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--base requires a Git ref/);
});

test("rejects a base ref that does not resolve", () => {
  const result = spawnSync(process.execPath, [script, "--base", "refs/heads/not-a-real-base"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /base ref does not resolve/);
});

test("falls back when an environment-provided base does not resolve", () => {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, SOLIDITY_TEST_BASE_REF: "refs/heads/not-a-real-environment-base" },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /follow the canonical format/);
});
