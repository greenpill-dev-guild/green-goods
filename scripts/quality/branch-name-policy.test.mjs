import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isWorkBranchName, workBranchNameErrors } from "./branch-name-policy.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "branch-name-policy.mjs");

test("accepts concrete work-based branch names", () => {
  for (const branch of [
    "feature/commitment-pooling-indexer",
    "fix/calendar-timezone-selection",
    "docs/commitment-pooling-architecture",
    "release/july-2026-v1-2-0",
    "chore/cleanup-regression-review",
  ]) {
    assert.equal(isWorkBranchName(branch), true, branch);
  }
});

test("rejects worker, issue, and lane identities", () => {
  for (const branch of [
    "codex/commitment-pooling",
    "feature/codex-contracts",
    "feature/claude-review",
    "fix/prd-123-calendar",
    "chore/qa-pass-2",
  ]) {
    assert.equal(isWorkBranchName(branch), false, branch);
  }
});

test("rejects unsupported structure and punctuation", () => {
  for (const branch of [
    "debug/incident-20260814",
    "release/july-2026-v1.2.0",
    "feature/profile/avatar",
    "feature/Profile-Avatar",
  ]) {
    assert.equal(isWorkBranchName(branch), false, branch);
  }
});

test("CLI reports semantic failures", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "feature/codex-contracts"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not encode a Codex or Claude identity/);
  assert.deepEqual(workBranchNameErrors("feature/commitment-pooling-indexer"), []);
});
