# Agent Research and Discussion Grounding Plan

**Feature Slug**: `agent-research-grounding`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-25T06:06:31.016Z`
**Last Updated**: `2026-08-25T06:44:40.000Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Add a passive, model-invoked `research` skill | Discussion grounding should activate from intent without a slash command |
| 2 | Research runs adaptively in the active agent | The first slice does not need delegation or parallel coordination |
| 3 | Resolve Plan Hub authority from `status.json.links` and the document map | Context pointers prevent large hubs from becoming indiscriminate loading exercises |
| 4 | Prefer user-named, canonical repository, live/current, and external primary sources | Authority and freshness must match the claim being researched |
| 5 | Separate facts, contradictions, inference, unresolved gaps, and human decisions | Evidence should constrain judgment without impersonating it |
| 6 | Keep research read-only and in chat unless durable evidence is explicitly requested | Avoids unrequested writes and parallel knowledge bases |
| 7 | Return accepted product and architecture decisions to `plan` | The owning Plan Hub remains canonical decision truth |
| 8 | Escalate unbounded work as a map-ready handoff, not a tracker | Preserves a future Wayfinder seam without importing its architecture now |
| 9 | Replace serial brainstorming questions with dependency-aware frontier rounds | Independent human choices can be answered together; dependent questions cannot |
| 10 | Use Commitment Pooling only as read-only behavioral proof | The research-guidance slice must not alter product decisions, specs, reports, or WIP |
| 11 | Extend existing contracts, fixtures, and documentation | No new dependencies, scripts, sidecars, instruction rules, or second skill tree |
| 12 | Keep this hub repository-only with no Linear mirror | The user explicitly excluded roadmap and execution tracking for this slice |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo patterns to extend
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Select the existing guidance, Plan Hub, and trigger-routing validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Passive research workflow and exclusions | `state_api` | Add `.claude/skills/research/SKILL.md` | ✅ |
| Planning research route and frontier rounds | `state_api` | Update `plan/SKILL.md` and `plan/brainstorm.md` | ✅ |
| Deterministic behavior guarantees | `state_api` | Extend behavior checker sources, contracts, and mutation tests | ✅ |
| Positive and near-neighbor trigger routing | `state_api` | Extend `skill-trigger-eval.json` | ✅ |
| Existing harness and builder documentation | `state_api` | Update `scripts/README.md` and the documented skill inventory | ✅ |
| Repository-only durable evidence | `state_api` | Maintain this Plan Hub with no Linear identifiers | ✅ |
| Commitment Pooling proving case | `state_api` | Run targeted read-only before/after forward test and record only its conclusion | BLOCKED: external model endpoints denied by sandbox |
| Full requested validation | `qa_pass_1` | Run selector, guidance checks, Plan Hub validation, and one trigger eval | PARTIAL: deterministic checks pass; live eval blocked |

## TDD / Proof Order

- [x] Define behavior contracts for source authority, adaptive branch stopping, fact/decision
  separation, read-only persistence, map escalation, and frontier rounds.
- [x] RED: run `node --test scripts/quality/check-skill-behavior-contracts.test.mjs` before the
  guidance implementation; the three new contracts failed because their required sections and
  markers did not exist.
- [x] Implement the smallest guidance and routing changes that satisfy the contracts.
- [x] GREEN: run the behavior contract tests and `bun run check:skill-behavior`.
- [x] Record machine-readable RED/GREEN proof with `plan-hub.mjs record-tdd`.

## Lane Checklists

### UI

- [x] Marked not applicable; no UI, i18n, or browser-visible behavior changes.

### State / API

- [x] Add the passive research skill and activation boundaries.
- [x] Add authority, adaptive branch, conclusion, persistence, and map-escalation behavior.
- [x] Route planning factual prerequisites through research.
- [x] Replace serial clarifiers with dependency-aware frontier rounds.
- [x] Extend behavior contracts, mutation tests, routing fixtures, and affected documentation.
- [x] Record GREEN proof in `handoffs/codex-state-api.md`.
- [x] Record the blocked forward-test conclusion in `handoffs/codex-state-api.md`.

### Contracts

- [x] Marked not applicable; no contract or release surface changes.

### QA Pass 1

- [x] Run every available selector-chosen deterministic check and the exact local test-plan commands.
- [x] Confirm Commitment Pooling stayed unchanged.

### QA Pass 2

- [ ] Run the one-time live trigger eval after the external Claude endpoint becomes available.
- [x] Reconcile Plan Hub state and record environment and receipt limits.

## Validation

- [x] `bun run validation:plan -- --intent readiness --risk sensitive`
- [x] `bun run check:skill-behavior`
- [x] `bun run test:review-guardrails`
- [x] `bun run check:guidance-links && bun run check:codex-guidance`
- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `bun run test:docs && bun run build:docs`
- [x] Scoped Biome format check for the changed script/JSON surfaces
- [ ] `bun format:check` (`BLOCKED` by an unchanged Commitment Pooling evidence JSON newline)
- [ ] `bun run eval:skills` once after the external Claude endpoint becomes available (`BLOCKED`)
- [ ] Read-only before/after Commitment Pooling discussion forward test under the same model and permissions (`BLOCKED`)
