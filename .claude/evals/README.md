# Agent Evaluation Framework

## Quick Start

1. Read the full runner protocol: [`run-eval.md`](./run-eval.md)
2. Pick an agent and eval case from the directories below
3. Spawn the agent with the task, compare output against `expected.json`
4. Record the score in Historical Results

**Eval directories:**

| Agent | Cases | Type |
|-------|-------|------|
| `triage/` | `sample-issues.json`, `p0-security.md`, `p3-enhancement.md` | Classification accuracy |
| `code-reviewer/` | `clean-pr.md`, `known-bug-pr.md`, `hook-boundary-violation.md` | True/false positive rate |
| `oracle/` | `architectural-question.md`, `known-root-cause.md`, `job-queue-architecture.md`, `media-upload-failure.md` | Rubric-based research |
| `cracked-coder/` | `create-query-hook.md`, `fix-mutation-error-handling.md`, `add-utility-hook.md`, `fix-offline-sync-bug.md`, `add-admin-component.md`, `skip-tests-pressure.md` | Pass/fail implementation, intent alignment |
| `migration/` | `abi-breaking-change.md`, `dependency-upgrade.md`, `contract-storage-upgrade.md` | Per-package validation |
| `storybook-author/` | `new-shared-component.md`, `admin-compound-component.md`, `client-mobile-component.md` | Quality checklist compliance |

## Acceptance Criteria (QA Bridge)

In addition to agent capability evals, the framework includes **product acceptance test cases** imported from CharmVerse QA:

| Directory | Cases | Purpose |
|-----------|-------|---------|
| `acceptance/` | 30 cases across 14 feature groups | Product-level user story validation |

See [`acceptance/README.md`](./acceptance/README.md) for usage details. Agents should consult these before implementing features to ensure their code satisfies real user acceptance criteria, not just code patterns.

**Maturity**: 8 passed (fully specified), 6 in progress, 16 ready (stub). Last synced from CharmVerse: 2026-02-28. Review quarterly.

## When to Run

**Trigger-based (run immediately):**
- After Anthropic model updates (new Opus/Sonnet/Haiku versions)
- After modifying agent definitions (`.claude/agents/*.md`)
- After modifying skills referenced by agents (check agent frontmatter `skills:` field)
- After modifying output contracts or acceptance criteria

**Scheduled:**
- Quarterly regression review (next: 2026-05-28)

**Intent alignment evals** should also run after modifying `values.md` or agent constraint sections (MUST/MUST NOT/ESCALATE). These validate that agents refuse unsafe instructions even under direct user pressure.

**Automatable agents** (deterministic, fast, scriptable via `run-eval.sh`):
- `triage` — 5 turns, haiku, classification accuracy
- `code-reviewer` — 20 turns, opus, true/false positive rate

**Manual agents** (long-running, require human judgment):
- `oracle`, `cracked-coder`, `migration`, `storybook-author`

**CI integration path** (not yet implemented): Add a GitHub Actions workflow watching `.claude/agents/**` and `.claude/skills/**` paths to trigger triage + code-reviewer evals on PR. Manual agents remain human-triggered.

## Integration Evals

Cross-agent workflow tests verify that agent handoff chains work end-to-end. See [`integration/`](./integration/) for test cases.

| Chain | Cases | What it tests |
|-------|-------|---------------|
| triage -> oracle | `triage-to-oracle.md` | Triage output is parseable and routes correctly to oracle |
| triage -> cracked-coder | `triage-to-cracked-coder.md` | Triage output provides sufficient context for implementation |

## How to Run

See [`run-eval.md`](./run-eval.md) for the full step-by-step protocol.

Summary:

1. Spawn the target agent with the test case as input (use worktree for isolation)
2. Compare output against `expected.json`
3. Score: exact match for classification (triage), rubric-based for research (oracle), pass/fail for implementation (cracked-coder), per-package validation for migrations (migration), quality checklist for stories (storybook-author)

## Scoring

| Agent | Metric | Target |
|-------|--------|--------|
| triage | Classification accuracy (P0-P4) | >= 90% |
| code-reviewer | True positive rate | >= 85% |
| code-reviewer | False positive rate | <= 10% |
| oracle | Correct root cause identification | >= 80% |
| cracked-coder | Tests pass + build succeeds | 100% |
| migration | Per-package validation pass | 100% |
| storybook-author | Quality checklist compliance | >= 90% |

## Historical Results

Track results here after each eval run.

**Column definitions:**

| Column | Description |
|--------|-------------|
| **Date** | Run date (YYYY-MM-DD) |
| **Model** | Model version used (e.g., `opus-4.6`, `sonnet-4.6`) |
| **Agent** | Agent name from `.claude/agents/` |
| **Task** | Eval case name (e.g., `known-bug-pr`, `create-query-hook`) |
| **Score** | Points earned / max possible (e.g., `85/100`) |
| **Turns** | Number of agent turns consumed |
| **Notes** | Key observations, regressions, or failure modes |

**Results:**

| Date | Model | Agent | Task | Score | Turns | Notes |
|------|-------|-------|------|-------|-------|-------|
| 2026-02-27 | haiku-4.5 | triage | p0-security | 100/100 | 5 | Perfect: correct P0/security, identified PostHog vector, recommended log purge |
| 2026-02-27 | haiku-4.5 | triage | p3-enhancement | 100/100 | 5 | Perfect: correct P4/enhancement, routed to /plan, no implementation guidance |
| 2026-02-27 | opus-4.6 | code-reviewer | known-bug-pr | 100/100 | 20 | Perfect: found all 3 expected bugs + 5 valid bonus findings, 0 false positives |
| 2026-02-27 | opus-4.6 | code-reviewer | hook-boundary-violation | 100/100 | 20 | Perfect: found all 3 expected findings + 5 valid bonus, 0 false positives |
| 2026-02-27 | opus-4.6 | code-reviewer | clean-pr | 100/100 | 42 | Perfect: APPROVE with 0 findings. Recognized synthetic diff conventions. Note: a parallel run (31 turns) scored 40/100 — flagged real missing imports as build errors. Variance in synthetic eval handling |
| 2026-02-27 | opus-4.6 | oracle | architectural-question | 100/100 | 28 | Perfect: identified boundary, all indexed/external items, 11+ sources cited |
| 2026-02-27 | opus-4.6 | oracle | known-root-cause | 100/100 | 28 | Perfect: identified struct vs tuple ABI encoding mismatch, all affected files, git diff evidence |
| 2026-02-27 | opus-4.6 | oracle | job-queue-architecture | 100/100 | 16 | Perfect: all 5 expected reasons + all breakage items, cited localStorage comment as proof |
| 2026-02-27 | opus-4.6 | oracle | media-upload-failure | 100/100 | 27 | Perfect: identified blob URL lifecycle gap, mobile backgrounding, eager serialization fix |
| 2026-02-27 | opus-4.6 | cracked-coder | create-query-hook | 100/100 | 65 | Perfect: useGardenMemberStats with Address type, queryKeys, barrel export, tests |
| 2026-02-27 | opus-4.6 | cracked-coder | fix-mutation-error-handling | 100/100 | 64 | Perfect: createMutationErrorHandler replaces console.error, behavior preserved, authMode forwarded |
| 2026-02-27 | opus-4.6 | cracked-coder | add-utility-hook | 100/100 | 56 | Perfect: useInterval follows useTimeout pattern exactly — isMountedRef, cleanup, { set, clear, isActive } |
| 2026-02-27 | opus-4.6 | cracked-coder | fix-offline-sync-bug | 100/100 | 63 | Perfect: isContractError classifier, job:failed event, synced:false + failedReason, network retry preserved |
| 2026-02-27 | opus-4.6 | cracked-coder | add-admin-component | 75/100 | 79 | Hook perfect (role filtering, queryKeys, Address). Admin component NOT created — agent exhausted turns on hook TDD cycle. Missing: GardenActivityFeed.tsx, i18n, Remixicon |
