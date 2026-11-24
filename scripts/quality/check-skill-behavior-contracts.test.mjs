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
  assert.equal(report.results.length, 15);
});
for (const [title, file, marker, replacement, failureId] of [
  [
    "architecture plan contract fails without human candidate selection",
    ".claude/skills/plan/SKILL.md",
    /Stop for human selection/i,
    "Select automatically",
    "plan-architecture-mode-requires-deletion-test-and-human-selection",
  ],
  [
    "architecture review contract fails without the deletion-test requirement",
    ".claude/skills/review/SKILL.md",
    /deletion test/i,
    "preferred style",
    "review-architecture-needs-concrete-harm-and-deletion-story",
  ],
  [
    "architecture audit contract fails when it prescribes the refactor",
    ".claude/skills/audit/SKILL.md",
    /friction but never prescribe the refactor/i,
    "friction and prescribe the refactor",
    "audit-observes-friction-without-prescribing-refactors",
  ],
  [
    "seam certification contract fails without registry freshness",
    ".claude/skills/module-seams-review/SKILL.md",
    /evidence fingerprint/i,
    "evidence note",
    "module-seams-review-reconciles-registry-freshness-and-proof-types",
  ],
  [
    "module-seams review contract fails without the read-only boundary",
    ".claude/skills/module-seams-review/SKILL.md",
    /Do not edit files/i,
    "Edit files",
    "module-seams-review-is-pinned-read-only-and-direct",
  ],
  [
    "audit contract fails without the explicit scope lock",
    ".claude/skills/audit/SKILL.md",
    /explicit user lock/i,
    "automatic implementation",
    "audit-read-only-scope-lock",
  ],
  [
    "research authority contract fails when Plan Hub pointer discipline drifts",
    ".agents/adapter.md",
    /document map/i,
    "complete directory",
    "research-follows-authority-and-stops-adaptive-branches",
  ],
  [
    "research map contract fails when automatic tracker creation is allowed",
    ".claude/skills/research/SKILL.md",
    /Create no tracker records/i,
    "Create tracker records automatically",
    "research-separates-decisions-persistence-and-map-escalation",
  ],
  [
    "brainstorm contract fails when frontier rounds regress to serial questions",
    ".claude/skills/plan/brainstorm.md",
    /Ask every independent frontier question/i,
    "Ask one frontier question",
    "brainstorm-researches-facts-and-asks-frontier-rounds",
  ],
  [
    "contract guard fails when raw Forge is allowed",
    "AGENTS.md",
    /Use the Bun contract wrappers, never raw Forge/i,
    "Use raw `forge` directly for contract work",
    "contracts-use-wrappers-without-broadcast-inference",
  ],
  [
    "contract guard fails when missing addresses imply a P0",
    "packages/contracts/AGENTS.md",
    /Pending broadcast[\s\S]{0,140}Do not turn this into a P0 by itself/i,
    "an automatic P0",
    "contracts-use-wrappers-without-broadcast-inference",
  ],
  [
    "visible-UI guard fails when the labeled-proof rule is replaced by any screenshot",
    ".claude/skills/review/SKILL.md",
    /Visible UI claims need rendered proof labeled by engine and session/i,
    "Visible UI claims need any screenshot",
    "visible-ui-needs-labeled-rendered-proof",
  ],
  [
    "evidence guard fails when a failed check is mapped to approval",
    ".claude/skills/review/SKILL.md",
    /failed required check gives `REQUEST_CHANGES`/i,
    "failed required check gives `APPROVE`",
    "failed-checks-cannot-be-passed-evidence",
  ],
  [
    "plan lifecycle guard fails when completed work remains active",
    ".agents/adapter.md",
    /plan-hub\.mjs move --feature <slug> --to archive/i,
    "plan-hub.mjs leave --feature <slug> active",
    "implemented-plans-transition-and-archive",
  ],
  [
    "plan lifecycle guard fails when finished plans stay open",
    ".claude/skills/plan/SKILL.md",
    /The PR that finishes a plan carries steps 1 to 5/,
    "Finished plans stay active; the PR carries steps 1 to 5",
    "implemented-plans-transition-and-archive",
  ],
  [
    "brainstorm contract fails when the user is asked for discoverable facts",
    ".claude/skills/plan/brainstorm.md",
    /to the `research` skill\./,
    "to the `research` skill or ask the user to reconstruct them.",
    "brainstorm-researches-facts-and-asks-frontier-rounds",
  ],
  [
    "Ship activation guard fails when a prefix turns QA language into a trigger",
    ".claude/skills/ship/SKILL.md",
    /^"QA mode"/m,
    'Activate for "QA mode"',
    "qa-language-does-not-trigger-ship",
  ],
  [
    "Ship activation guard fails when QA language becomes a trigger",
    ".claude/skills/ship/SKILL.md",
    /do not publish unless the user also asks/i,
    "publish even if the user never asks",
    "qa-language-does-not-trigger-ship",
  ],
]) {
  test(title, () => {
    const sources = replaceRequiredMarker(liveSources, file, marker, replacement);
    assert.deepEqual(failedScenarioIds(evaluateSkillBehaviorContracts(sources)), [failureId]);
  });
}
