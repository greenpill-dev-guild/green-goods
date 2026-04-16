# {{FEATURE_TITLE}} Plan

**Feature Slug**: `{{FEATURE_SLUG}}`
**Stage**: `{{STAGE}}`
**Status**: `ACTIVE`
**Created**: `{{DATE}}`
**Last Updated**: `{{DATE}}`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | | |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| | `ui` | | ⏳ |
| | `state_api` | | ⏳ |
| | `contracts` | | ⏳ |

## Lane Checklists

### UI (`claude/ui/{{FEATURE_SLUG}}`)

- [ ] UI tasks only
- [ ] Add i18n for new user-facing strings
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/{{FEATURE_SLUG}}`)

- [ ] Hooks, stores, query keys, API flows
- [ ] Keep hooks in shared
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/{{FEATURE_SLUG}}`)

- [ ] Contract logic and tests
- [ ] Respect deployment ordering and upgrade safety
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/{{FEATURE_SLUG}}`)

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/{{FEATURE_SLUG}}`)

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
