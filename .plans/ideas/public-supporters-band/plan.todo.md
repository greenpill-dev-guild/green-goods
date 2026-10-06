# Public Supporters / Partnerships Section Plan

**Feature Slug**: `public-supporters-band`
**Stage**: `ideas`
**Status**: `CLOSED — canceled idea; closeout record ready for the archive sequence`
**Created**: `2026-04-29T05:49:32.687Z`
**Last Updated**: `2026-10-06`

## Status reconciliation (2026-10-06)

[PRD-347](https://linear.app/greenpill-dev-guild/issue/PRD-347) is Canceled in live Linear. The existing tracker was canceled; no implementation or retained partner-display scope was accepted in this review. All unstarted lanes are skipped as canceled scope, not passed implementation. This hub stays on disk until its closeout record is committed and the normal archive sequence can preserve it in Git history. No Linear issue is reopened.

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

## Closeout (2026-10-06)

Resolution: `cancelled`. No implementation is claimed shipped by this hub. The existing tracker was canceled; no implementation or retained partner-display scope was accepted in this review.

Still open or dispositioned:

- No implementation is retained. Any future supporter display requires a new scope decision and partner-content permission review; the historical candidate is dropped from dispatch.
- Preserve the original unfinished lane states and keep dispatch disabled. The premature sync confirmation is invalidated. After the human merge, apply the preservation manifest (stateSyncMode=preserve_existing), verify that the mirror remains Canceled, and only then record a fresh confirmation before archive. The earlier confirmation remains invalidated; this repair makes no external Linear write.
