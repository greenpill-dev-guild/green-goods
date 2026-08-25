import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSkillBehaviorContracts,
  loadSkillBehaviorSources,
} from "./check-skill-behavior-contracts.mjs";

function cloneSources(sources) {
  return { ...sources };
}

function failedScenarioIds(report) {
  return report.failures.map(({ id }) => id);
}

function replaceRequiredMarker(sources, file, marker, replacement) {
  const changed = cloneSources(sources);
  assert.match(changed[file], marker, `fixture marker must exist in ${file}`);
  changed[file] = changed[file].replace(marker, replacement);
  return changed;
}

const liveSources = loadSkillBehaviorSources();

test("live guidance satisfies every skill behavior contract", () => {
  const report = evaluateSkillBehaviorContracts(liveSources);
  assert.deepEqual(report.failures, []);
  assert.equal(report.results.length, 12);
});
test("architecture plan contract fails without human candidate selection", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/plan/SKILL.md",
    /Stop for human selection/i,
    "Select automatically",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "plan-architecture-mode-requires-deletion-test-and-human-selection",
  ]);
});
test("architecture review contract fails without the deletion-test requirement", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/review/SKILL.md",
    /deletion test/i,
    "preferred style",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "review-architecture-needs-concrete-harm-and-deletion-story",
  ]);
});
test("architecture audit contract fails when it prescribes the refactor", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/audit/SKILL.md",
    /friction but never prescribe the refactor/i,
    "friction and prescribe the refactor",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "audit-observes-friction-without-prescribing-refactors",
  ]);
});
test("seam certification contract fails without registry freshness", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/module-seams-review/SKILL.md",
    /evidence fingerprint/i,
    "evidence note",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "module-seams-review-reconciles-registry-freshness-and-proof-types",
  ]);
});
test("module-seams review contract fails without the read-only boundary", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/module-seams-review/SKILL.md",
    /Do not edit files/i,
    "Edit files",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "module-seams-review-is-pinned-read-only-and-direct",
  ]);
});
test("audit contract fails without the explicit scope lock", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/audit/SKILL.md",
    /explicit user lock/i,
    "automatic implementation",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "audit-read-only-scope-lock",
  ]);
});

test("contract guard fails when raw Forge is allowed", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    "AGENTS.md",
    /Never use raw `forge`; use the repo's bun scripts/i,
    "Use raw `forge` directly for contract work",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "contracts-use-wrappers-without-broadcast-inference",
  ]);
});

test("contract guard fails when missing addresses imply a P0", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    "AGENTS.md",
    /pending broadcast[\s\S]{0,80}not an automatic P0/i,
    "an automatic P0",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "contracts-use-wrappers-without-broadcast-inference",
  ]);
});

test("visible-UI guard fails when blocked Brave proof is replaced by isolated proof", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/review/SKILL.md",
    /reported as blocked/i,
    "substituted with isolated browser proof",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "visible-ui-needs-authenticated-brave-or-blocked",
  ]);
});

test("evidence guard fails when a failed check is mapped to approval", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/review/SKILL.md",
    /failed required check → `REQUEST_CHANGES`/i,
    "failed required check → `APPROVE`",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "failed-checks-cannot-be-passed-evidence",
  ]);
});

test("plan lifecycle guard fails when completed work remains active", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/plan/SKILL.md",
    /If fully implemented, move the hub to `\.plans\/archive\/`/i,
    "If fully implemented, leave the hub active",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "implemented-plans-transition-and-archive",
  ]);
});

test("Ship activation guard fails when QA language becomes a trigger", () => {
  const sources = replaceRequiredMarker(
    liveSources,
    ".claude/skills/ship/SKILL.md",
    /Do not activate this skill for "QA mode"/i,
    "Activate this skill for \"QA mode\"",
  );

  assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [
    "qa-language-does-not-trigger-ship",
  ]);
});
