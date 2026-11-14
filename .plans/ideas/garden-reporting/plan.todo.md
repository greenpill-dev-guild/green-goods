# Garden Reporting in the Steward Cockpit Plan

**Feature Slug**: `garden-reporting`
**Stage**: `ideas`
**Status**: `ACTIVE`
**Created**: `2026-11-13T22:12:15.724Z`
**Last Updated**: `2026-11-13T22:20:00.000Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Each report sits in the shipped tab whose components it improves, not on a separate Reports page (review, 2026-11-13). | Stewards already work in those tabs; one place per question, built on the current design. |
| 2 | Garden › Health gets a new Review Health card under Garden Health, which stays as it ships (review, 2026-11-13). | Adds the trend and the stall verdict without changing a shipped card. |
| 3 | Waiting age is plain metadata in the Hub, and pending is neutral across the reports. | DL-044: age is never an alarm; the Hub's cards already say "Pending" in neutral. |
| 4 | Records open in the cockpit's dialog pattern, as Review Work does. | The left-sheet channel renders an `AdminDialog`; side sheets are retired for records. |
| 5 | Proposal, not decided: the first slice is the calendar plus Review Health, on a month-range work read that returns counts. | Highest-frequency questions; the data mostly exists; the stall rule ships already. The month-range read is the one prerequisite. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (Hub, Garden and Community tabs; `AdminDialog` records)
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [ ] Choose the first slice in review
- [ ] Choose the lightest honest validation commands for that slice

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Month-range work read with counts | `state_api` | First slice, step 1 | ⏳ |
| Garden › Activity calendar | `ui` | First slice, step 2 | ⏳ |
| Garden › Health Review Health card | `ui` | First slice, step 3 | ⏳ |
| Hub › Work waiting chips | `ui` | After the first slice | ⏳ |
| Places, season timeline, output trends, evidence, participation, funding history | `ui`, `state_api` | Unscheduled until their data gaps close | ⏳ |
| Contract changes | `contracts` | None | n/a |

## Prototype and Walkthrough

- [x] Storybook prototype: `packages/admin/src/views/ReportingLab/`, stories under
  `Admin/Prototypes/Garden Reporting/*`; not routed or imported by the app.
- [x] Clickable walkthrough: source in `artifacts/walkthrough/` (see `artifacts/README.md`),
  published as a private claude.ai artifact.
- [ ] Review the walkthrough and choose the first slice.

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI

- [ ] Port the chosen report into its shipped tab
- [ ] Add i18n for new user-facing strings
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API

- [ ] Month-range work read with totals and review timestamps
- [ ] Keep hooks in shared
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### QA Pass 1

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] Choose with `bun run check --plan -- --intent qa` once a slice touches app code
- [ ] `bun run test` for the touched packages
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
