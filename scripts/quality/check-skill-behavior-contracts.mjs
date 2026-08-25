#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");

export const SOURCE_PATHS = [
  "AGENTS.md",
  ".claude/context/codebase-architecture.md",
  ".claude/context/values.md",
  ".claude/skills/audit/SKILL.md",
  ".claude/skills/module-seams-review/SKILL.md",
  ".claude/skills/plan/SKILL.md",
  ".claude/skills/plan/brainstorm.md",
  ".claude/skills/research/SKILL.md",
  ".claude/skills/review/SKILL.md",
  ".claude/skills/ship/SKILL.md",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMarkdownSection(markdown, heading) {
  const headingPattern = new RegExp(
    `^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`,
    "m",
  );
  const match = headingPattern.exec(markdown);
  if (!match) return null;

  const level = match[1].length;
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const nextHeadingPattern = /^(#{1,6})\s+.+$/gm;
  let next;

  while ((next = nextHeadingPattern.exec(rest)) !== null) {
    if (next[1].length <= level) {
      return rest.slice(0, next.index);
    }
  }

  return rest;
}

const contracts = [
  {
    id: "canonical-architecture-model-separates-depth-seams-and-boundaries",
    summary:
      "The shared architecture model defines depth and keeps ownership boundaries distinct from substitution seams.",
    requirements: [
      {
        file: ".claude/context/codebase-architecture.md",
        section: "Vocabulary",
        pattern: /Depth[\s\S]{0,180}small, stable interface/i,
        marker: "depth as interface leverage",
      },
      {
        file: ".claude/context/codebase-architecture.md",
        section: "Boundary and seam are different",
        pattern: /boundary[\s\S]{0,180}seam[\s\S]{0,220}does not automatically/i,
        marker: "boundary and seam distinction",
      },
    ],
  },
  {
    id: "plan-architecture-mode-requires-deletion-test-and-human-selection",
    summary:
      "Architecture planning ranks bounded candidates, applies the deletion test, and stops for human selection.",
    requirements: [
      {
        file: ".claude/skills/plan/SKILL.md",
        section: "Architecture Opportunity Mode",
        pattern: /three to six candidate cards[\s\S]{0,220}deletion-test result/i,
        marker: "ranked candidate cards with deletion test",
      },
      {
        file: ".claude/skills/plan/SKILL.md",
        section: "Architecture Opportunity Mode",
        pattern: /Stop for human selection[\s\S]{0,180}Do not[\s\S]{0,120}machine registry/i,
        marker: "human selection before registry",
      },
    ],
  },
  {
    id: "review-architecture-needs-concrete-harm-and-deletion-story",
    summary:
      "Structural review requires concrete harm and a deletion story rather than recommending speculative abstraction.",
    requirements: [
      {
        file: ".claude/skills/review/SKILL.md",
        section: "Pass 1 — Regressions",
        pattern: /Require a concrete failure or repeated maintenance cost[\s\S]{0,180}deletion test/i,
        marker: "concrete harm and deletion-test rule",
      },
      {
        file: ".claude/skills/review/SKILL.md",
        pattern: /repository-wide architecture opportunity discovery to `plan`/i,
        marker: "architecture discovery routing",
      },
    ],
  },
  {
    id: "audit-observes-friction-without-prescribing-refactors",
    summary:
      "Audit may measure architecture friction but routes selection and never prescribes the replacement.",
    requirements: [
      {
        file: ".claude/skills/audit/SKILL.md",
        section: "False-Positive Guardrails",
        pattern: /do not recommend new abstractions, patterns, or layers/i,
        marker: "no architecture prescription",
      },
      {
        file: ".claude/skills/audit/SKILL.md",
        section: "Boundary",
        pattern: /friction but never prescribe the refactor[\s\S]{0,180}route to `plan`/i,
        marker: "friction-to-plan routing",
      },
    ],
  },
  {
    id: "research-follows-authority-and-stops-adaptive-branches",
    summary:
      "Research resolves source authority, loads targeted evidence, and stops adaptive branches at explicit boundaries.",
    requirements: [
      {
        file: ".claude/skills/research/SKILL.md",
        section: "2. Resolve authority",
        pattern: new RegExp(
          String.raw`status\.json.*links[\s\S]{0,220}document map[\s\S]{0,300}targeted`,
          "i",
        ),
        marker: "Plan Hub pointers and targeted loading",
      },
      {
        file: ".claude/skills/research/SKILL.md",
        section: "2. Resolve authority",
        pattern:
          /external primary sources[\s\S]{0,200}(official documentation|first-party API|source code|specification)/i,
        marker: "external first-party authority",
      },
      {
        file: ".claude/skills/research/SKILL.md",
        section: "3. Follow the evidence",
        pattern:
          /could change the answer or unblock the decision[\s\S]{0,260}authoritative evidence[\s\S]{0,420}outside the research scope/i,
        marker: "adaptive branch follow and stop rules",
      },
    ],
  },
  {
    id: "research-separates-decisions-persistence-and-map-escalation",
    summary:
      "Research separates facts from decisions, stays read-only by default, and escalates unbounded work without tracker writes.",
    requirements: [
      {
        file: ".claude/skills/research/SKILL.md",
        section: "1. Frame the work",
        pattern:
          /decision it unblocks[\s\S]{0,180}facts[\s\S]{0,180}human decisions/i,
        marker: "fact and human-decision separation",
      },
      {
        file: ".claude/skills/research/SKILL.md",
        section: "Persistence",
        pattern:
          /read-only by default[\s\S]{0,240}explicitly asks[\s\S]{0,300}canonical Plan Hub/i,
        marker: "explicit persistence and canonical decision routing",
      },
      {
        file: ".claude/skills/research/SKILL.md",
        section: "Map escalation",
        pattern:
          /map-ready handoff[\s\S]{0,220}Destination[\s\S]{0,220}Settled facts and decisions[\s\S]{0,240}Sharp frontier questions[\s\S]{0,220}Remaining fog[\s\S]{0,180}Dependencies[\s\S]{0,180}Out of scope/i,
        marker: "map-ready handoff fields",
      },
      {
        file: ".claude/skills/research/SKILL.md",
        section: "Map escalation",
        pattern: /Do not create tracker records automatically/i,
        marker: "no automatic tracker writes",
      },
    ],
  },
  {
    id: "brainstorm-researches-facts-and-asks-frontier-rounds",
    summary:
      "Planning researches factual prerequisites and asks independent human decisions in dependency-aware rounds.",
    requirements: [
      {
        file: ".claude/skills/plan/brainstorm.md",
        section: "3. Resolve the decision frontier",
        pattern:
          /Route bounded factual\s+prerequisites through the `research` skill[\s\S]{0,220}do not ask the\s+user/i,
        marker: "research-before-questioning route",
      },
      {
        file: ".claude/skills/plan/brainstorm.md",
        section: "3. Resolve the decision frontier",
        pattern:
          /Ask every independent question on the current frontier[\s\S]{0,220}numbered round[\s\S]{0,220}recommended answer/i,
        marker: "recommended frontier rounds",
      },
      {
        file: ".claude/skills/plan/brainstorm.md",
        section: "3. Resolve the decision frontier",
        pattern:
          /depends on another unsettled question[\s\S]{0,200}later round/i,
        marker: "deferred dependent questions",
      },
    ],
  },
  {
    id: "module-seams-review-reconciles-registry-freshness-and-proof-types",
    summary:
      "Specialist seam certification reconciles registry freshness and keeps direct, conformance, wiring, composition, and coverage proof distinct.",
    requirements: [
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "1. Build the boundary graph",
        pattern: /module-seam-registry\.json[\s\S]{0,220}evidence fingerprint/i,
        marker: "registry fingerprint reconciliation",
      },
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "3. Review direct-test and mock fidelity",
        pattern: /direct subject behavior[\s\S]{0,180}adapter conformance[\s\S]{0,180}coverage/i,
        marker: "distinct seam proof categories",
      },
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "6. Reconcile intent and recurrence",
        pattern: /static import\/path checks do\s+not prove module depth/i,
        marker: "checker-limit disclosure",
      },
    ],
  },
  {
    id: "module-seams-review-is-pinned-read-only-and-direct",
    summary:
      "Module-seams review pins the candidate, stays read-only, and rejects mock-only subject proof.",
    requirements: [
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "Read-only boundary",
        pattern: /Do not edit files[\s\S]{0,220}explicit human scope lock/i,
        marker: "read-only scope-lock boundary",
      },
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "Scope and candidate",
        pattern: /Pin the exact `base\.\.head` range[\s\S]{0,220}Never replace it/i,
        marker: "pinned candidate range",
      },
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "3. Review direct-test and mock fidelity",
        pattern:
          /own specifier[\s\S]{0,180}must\s+not mock that same specifier/i,
        marker: "direct subject proof rule",
      },
      {
        file: ".claude/skills/module-seams-review/SKILL.md",
        section: "Validation",
        pattern: /An unavailable[\s\S]{0,220}is\s+`BLOCKED`[\s\S]{0,120}do not retry/i,
        marker: "blocked environment evidence rule",
      },
    ],
  },
  {
    id: "audit-read-only-scope-lock",
    summary: "Audit stays read-only until a human locks numbered findings.",
    requirements: [
      {
        file: ".claude/skills/audit/SKILL.md",
        pattern: /context:\s*fork/i,
        marker: "forked audit context",
      },
      {
        file: ".claude/skills/audit/SKILL.md",
        pattern: /Never edit files during an audit/i,
        marker: "read-only audit boundary",
      },
      {
        file: ".claude/skills/audit/SKILL.md",
        section: "Part 9: Implementation Handoff",
        pattern:
          /complete the read-only audit first[\s\S]{0,220}explicit user lock/i,
        marker: "read-only-first scope-lock handoff",
      },
    ],
  },
  {
    id: "contracts-use-wrappers-without-broadcast-inference",
    summary:
      "Contract work uses Bun wrappers and pre-broadcast addresses are not defects by inference.",
    requirements: [
      {
        file: "AGENTS.md",
        section: "Global Invariants",
        pattern: /Never use raw `forge`; use the repo's bun scripts/i,
        marker: "Bun wrapper requirement",
      },
      {
        file: "AGENTS.md",
        section: "Contract Deployment Review Phases",
        pattern: /pending broadcast[\s\S]{0,80}not an automatic P0/i,
        marker: "pre-broadcast phase distinction",
      },
      {
        file: ".claude/skills/review/SKILL.md",
        section: "False-Positive Guardrails",
        pattern:
          /Zero\/missing deployment addresses[\s\S]{0,140}pending broadcast[\s\S]{0,140}unless broadcast was claimed/i,
        marker: "review false-positive guard",
      },
    ],
  },
  {
    id: "visible-ui-needs-authenticated-brave-or-blocked",
    summary:
      "Visible-UI claims require authenticated Brave evidence or an explicit blocked result.",
    requirements: [
      {
        file: ".claude/skills/review/SKILL.md",
        section: "Pass 3 — Evidence or Production Quality",
        pattern:
          /Visible-UI\s+claims[\s\S]{0,180}authenticated Brave[\s\S]{0,120}reported as blocked/i,
        marker: "authenticated-Brave-or-blocked rule",
      },
    ],
  },
  {
    id: "failed-checks-cannot-be-passed-evidence",
    summary:
      "Fresh evidence is required and failed or blocked checks cannot produce approval.",
    requirements: [
      {
        file: ".claude/context/values.md",
        section: "Implementation Quality Contract",
        pattern:
          /Evidence before claims[\s\S]{0,120}only after fresh proof/i,
        marker: "fresh evidence before claims",
      },
      {
        file: ".claude/skills/review/SKILL.md",
        section: "Pass 3 — Evidence or Production Quality",
        pattern:
          /required stage that fails[\s\S]{0,50}`REQUEST_CHANGES`[\s\S]{0,100}cannot run[\s\S]{0,50}`COMMENT_ONLY`/i,
        marker: "failed and blocked readiness mapping",
      },
      {
        file: ".claude/skills/review/SKILL.md",
        section: "Output Contract",
        pattern:
          /failed required check[\s\S]{0,50}`REQUEST_CHANGES`[\s\S]{0,160}`BLOCKED`[\s\S]{0,100}`COMMENT_ONLY`/i,
        marker: "verdict mapping",
      },
    ],
  },
  {
    id: "implemented-plans-transition-and-archive",
    summary:
      "Completed implementation plans update lifecycle state and leave the active plan set.",
    requirements: [
      {
        file: ".claude/skills/plan/SKILL.md",
        section: "Part 5: Plan Lifecycle Management",
        pattern:
          /fully implements a plan[\s\S]{0,160}Status[\s\S]{0,100}status\.json/i,
        marker: "implementation lifecycle update",
      },
      {
        file: ".claude/skills/plan/SKILL.md",
        section: "Part 5: Plan Lifecycle Management",
        pattern: /If fully implemented, move the hub to `\.plans\/archive\/`/i,
        marker: "completed-plan archive transition",
      },
    ],
  },
  {
    id: "qa-language-does-not-trigger-ship",
    summary:
      "QA-speed language is excluded from Ship unless the user asks for a ship outcome.",
    requirements: [
      {
        file: ".claude/skills/ship/SKILL.md",
        section: "Activation",
        pattern:
          /Do not activate this skill for "QA mode", "quick fix", "get this to staging"[\s\S]{0,160}unless the user also asks to commit, open a PR, merge, release,[\s\S]{0,80}prove the branch is ready/i,
        marker: "QA-to-Ship anti-trigger",
      },
    ],
  },
];

export function loadSkillBehaviorSources(repoRoot = REPO_ROOT) {
  return Object.fromEntries(
    SOURCE_PATHS.map((relativePath) => [
      relativePath,
      fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
    ]),
  );
}

export function evaluateSkillBehaviorContracts(sources) {
  const results = contracts.map((contract) => {
    const failures = [];

    for (const requirement of contract.requirements) {
      const source = sources[requirement.file];
      if (typeof source !== "string") {
        failures.push(`${requirement.file}: source is missing`);
        continue;
      }

      const searchable = requirement.section
        ? extractMarkdownSection(source, requirement.section)
        : source;
      if (searchable === null) {
        failures.push(
          `${requirement.file}: section "${requirement.section}" is missing`,
        );
        continue;
      }

      if (!requirement.pattern.test(searchable)) {
        failures.push(
          `${requirement.file}${requirement.section ? `#${requirement.section}` : ""}: missing ${requirement.marker}`,
        );
      }
    }

    return {
      id: contract.id,
      summary: contract.summary,
      passed: failures.length === 0,
      failures,
    };
  });

  return {
    passed: results.every((result) => result.passed),
    results,
    failures: results.filter((result) => !result.passed),
  };
}

function main() {
  let sources;
  try {
    sources = loadSkillBehaviorSources();
  } catch (error) {
    console.error(`skill behavior contracts: unable to load sources: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const report = evaluateSkillBehaviorContracts(sources);
  if (!report.passed) {
    console.error("skill behavior contracts: FAILED");
    for (const result of report.failures) {
      console.error(`- ${result.id}: ${result.summary}`);
      for (const failure of result.failures) console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`skill behavior contracts: ${report.results.length} scenarios passed`);
}

if (path.resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
