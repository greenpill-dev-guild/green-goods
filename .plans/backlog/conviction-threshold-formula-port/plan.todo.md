# Conviction Threshold Formula Port Plan

**Feature Slug**: `conviction-threshold-formula-port`
**Stage**: `backlog`
**Status**: `ACTIVE`
**Created**: `2026-05-08T00:09:55.347Z`
**Last Updated**: `2026-05-08T00:09:55.347Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | | |

## Research / Plan Gate

- [ ] Record research evidence in `spec.md`
- [ ] Identify the existing repo pattern to mirror
- [ ] List human judgment points before implementation
- [ ] Define what is out of scope
- [ ] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| | `ui` | | ⏳ |
| | `state_api` | | ⏳ |
| | `contracts` | | ⏳ |

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI (`claude/ui/conviction-threshold-formula-port`)

- [ ] UI tasks only
- [ ] Add i18n for new user-facing strings
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/conviction-threshold-formula-port`)

- [ ] Hooks, stores, query keys, API flows
- [ ] Keep hooks in shared
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/conviction-threshold-formula-port`)

- [ ] Contract logic and tests
- [ ] Respect deployment ordering and upgrade safety
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/conviction-threshold-formula-port`)

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/conviction-threshold-formula-port`)

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
