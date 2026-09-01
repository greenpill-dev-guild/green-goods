# CI-First Validation Balance Plan

**Feature Slug**: `ci-first-validation`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-09-01T02:51:51.962Z`
**Last Updated**: `2026-09-01T02:51:51.962Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | GitHub CI owns broad merge readiness | Avoid repeating affected-package suites locally. |
| 2 | `push` is the bounded ready-for-CI intent | Preserve a clear local proof point without calling it merge approval. |
| 3 | Routine/sensitive deadlines are 90/180 seconds | Make the speed target executable rather than advisory. |
| 4 | Critical overrides remain uncapped | Speed cannot suppress contract, Auth, Work, JobQueue, or mutation safety. |
| 5 | Reuse the exact receipt model | Gain de-duplication without weakening freshness or trust. |
| 6 | Narrow only Design, Ontology, and Supply Chain routing | Keep broad application consumer suites in CI. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Bounded ready-for-CI selection and execution | `state_api` | Steps 1-2 | ✅ |
| Duplicate local hooks removed with safe receipt reuse | `state_api` | Step 3 | ✅ |
| Design/Ontology/Supply CI safely narrowed | `state_api` | Step 4 | ✅ |
| Agent workflows use current-head CI authority | `state_api` | Step 5 | ✅ |
| Critical overrides and final readiness remain intact | `qa_pass_1`, `qa_pass_2` | Step 6 | ⏳ CI |

## TDD / Proof Order

- [x] Identify the behavior boundary for each implementation lane before editing code
- [x] Write or select the minimal failing test/proof first
- [x] Run the RED command and record evidence in the lane handoff
- [x] Implement the smallest change that can satisfy the proof
- [x] Run the GREEN command and record evidence in the lane handoff
- [x] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI

- [x] Mark not applicable; no product surface changes.

### State / API

- [x] Add RED coverage for fast push plans, budget failure, receipts, and CI routing.
- [x] Implement selector and runner behavior without changing product package APIs.
- [x] Replace duplicate hooks and align CI workflows and agent guidance.
- [x] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-state-api.md`

### Contracts

- [x] Mark not applicable; retain regression coverage for contract critical overrides.

### QA Pass 1

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Implementation Steps

1. Add failing selector and runner tests for bounded push plans and deadline behavior.
2. Implement focused push selection, budget fields/statuses, and runtime deadline enforcement.
3. Replace duplicate hooks and connect exact passing receipts to pre-push.
4. Narrow Design, Ontology, and Supply Chain workflow routing with parity tests.
5. Align canonical guidance and PR/review/team skills with current-head CI authority.
6. Run targeted infrastructure tests, three warm timing probes, the explicit full Ship Gate, and
   GitHub CI before merge.

## Validation

- [x] `bun run validation:plan -- --intent ship`
- [x] Validation selector and runner test suites
- [x] Workflow routing, ontology anchor, and performance parity tests
- [x] Three warm routine push probes complete within 90 seconds
- [x] `node scripts/dev/ci-local.js --intent ship --reuse-passing-receipts`
- [ ] Required GitHub CI checks pass at the current PR head
