# Design System Alignment Review Plan

**Feature Slug**: `design-system-alignment-review`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete the old implementation plan; keep this as a review plan | The old sweep had completed code/token enforcement and manual QA moved elsewhere. |
| 2 | Start read-only | Design-system fixes can touch shared tokens, stories, docs, and agent guidance; the review should prove drift before editing. |
| 3 | Use the Claude-owned protocol | `AGENTS.md` names `.claude/skills/design/system-alignment-review.md` as the single source for this review shape. |
| 4 | Treat validators as proof boundaries | Passing validators narrow what can honestly be called drift. |

## Research / Plan Gate

- [ ] Read `.claude/skills/design/system-alignment-review.md`.
- [ ] Record exact source-of-truth order in the review notes.
- [ ] Run or explicitly block each validator in `spec.md`.
- [ ] Record file:line evidence for every confirmed drift.
- [ ] Keep fix recommendations separate from implementation.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Run the design alignment protocol read-only | `ui` | Step 1 | ⏳ |
| Verify generated/token/vocab/story validators before claiming drift | `ui` | Step 2 | ⏳ |
| Produce bounded findings with evidence and rejected false positives | `ui` | Step 3 | ⏳ |
| Avoid state/API and contract work | `state_api` / `contracts` | n/a | ✅ |

## Lane Checklists

### UI (`claude/ui/design-system-alignment-review`)

- [ ] Read the required protocol.
- [ ] Run the validator set from `spec.md`.
- [ ] Review DesignMD sources, runtime tokens, Storybook, admin, client, docs, and agent guidance.
- [ ] Write findings in the protocol format.
- [ ] Write `handoffs/claude-ui.md`.

### State / API (`codex/state-api/design-system-alignment-review`)

- [x] Mark this lane `n/a`.

### Contracts (`codex/contracts/design-system-alignment-review`)

- [x] Mark this lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/design-system-alignment-review`)

- [ ] Confirm findings are evidence-backed and do not include speculative fixes.
- [ ] Confirm considered-and-rejected items are present.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/design-system-alignment-review`)

- [ ] Re-run any validator that was used as a proof boundary.
- [ ] Check that status/history matches the actual review outcome.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `bun run lint:vocab`
- [ ] `cd packages/shared && bun run check:stories`
- [ ] `cd packages/shared && bun run check:story-quality`
- [ ] `node scripts/plan-hub.mjs validate`
