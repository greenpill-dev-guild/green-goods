import assert from "node:assert/strict";
import test from "node:test";

import { findNearDuplicatePolicyBlocks } from "./check-codex-docs.js";

test("detects a near-verbatim policy copied between agent guides", () => {
  const rootGuide = `
## Validation

Before validation, render the repository-owned plan. Execute the selected checks instead of
inventing a broader command set. A missing selector never authorizes omitting a required critical
override, and an unavailable environment capability must remain blocked rather than passing.
`;
  const claudeGuide = `
## Validation routing

Before validation render the repository owned plan, then execute its selected checks rather than
inventing a broader command set. A missing selector never authorizes omission of a required critical
override. An unavailable environment capability remains blocked, never passing.
`;

  const duplicates = findNearDuplicatePolicyBlocks(rootGuide, claudeGuide);

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].leftLine, 4);
  assert.equal(duplicates[0].rightLine, 4);
  assert.ok(duplicates[0].similarity >= 0.8);
});

test("ignores short shared labels and genuinely different guidance", () => {
  const rootGuide = `
## Validation

Use Bun wrappers.

Run targeted behavior tests while editing. Escalate only when a shared public contract changes.
`;
  const claudeGuide = `
## Commands

Use Bun wrappers.

Claude may dispatch Codex through the checked-in resolver when a plan explicitly assigns a Codex lane.
`;

  assert.deepEqual(findNearDuplicatePolicyBlocks(rootGuide, claudeGuide), []);
});

test("reports each duplicated policy block once", () => {
  const sharedPolicy = `
Every passing receipt is reusable only while its source inputs, command, policy, toolchain,
environment profile, and validated paths still match. Never reuse a failure, and stop dependent
work after the first deterministic failure unless the rendered plan marks checks independent.
`;

  const duplicates = findNearDuplicatePolicyBlocks(sharedPolicy, sharedPolicy);

  assert.equal(duplicates.length, 1);
});
