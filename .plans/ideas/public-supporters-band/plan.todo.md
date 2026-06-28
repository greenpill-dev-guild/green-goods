# Public Supporters / Partnerships Section Plan

**Feature Slug**: `public-supporters-band`
**Stage**: `backlog`
**Status**: `ACTIVE`
**Created**: `2026-04-29T05:49:32.687Z`
**Last Updated**: `2026-04-29T05:49:32.687Z`

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

## Lane Checklists

### UI (`claude/ui/public-supporters-band`)

- [ ] UI tasks only
- [ ] Add i18n for new user-facing strings
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/public-supporters-band`)

- [ ] Hooks, stores, query keys, API flows
- [ ] Keep hooks in shared
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/public-supporters-band`)

- [ ] Contract logic and tests
- [ ] Respect deployment ordering and upgrade safety
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/public-supporters-band`)

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/public-supporters-band`)

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
