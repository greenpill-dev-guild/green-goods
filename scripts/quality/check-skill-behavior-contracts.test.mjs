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
  assert.equal(report.results.length, 7);
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
