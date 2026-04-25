# Docs Freshness Routine Plan

**Feature Slug**: `docs-freshness-routine`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Promote the docs freshness note to backlog | The work is specific, pickable, and tied to current docs assets. |
| 2 | One docs freshness family per run | Keeps maintenance PRs reviewable and avoids docs churn. |
| 3 | Keep docs redesign out of scope | This routine is about drift and freshness, not information architecture. |
| 4 | Regenerate visual assets from real surfaces | Social cards and screenshots must reflect actual docs/client/admin output. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Script per-route social-card regeneration | `state_api` | Step 1 | ⏳ |
| Expand social card coverage to high-value pages | `state_api` | Step 2 | ⏳ |
| Ground adjacent gardener-guide pages in source/UI behavior | `state_api` | Step 3 | ⏳ |
| Refresh stale legacy deck/community assets | `state_api` | Step 4 | ⏳ |
| Add MDX build-break prevention checks | `state_api` | Step 5 | ⏳ |
| Add stale screenshot/card/last-verified drift detection | `state_api` | Step 6 | ⏳ |

## Steps

### Step 1: Script social-card regeneration

- [ ] Add or refine `docs/scripts/gen-social-cards.mjs`.
- [ ] Capture cards at 1440x900 from real docs pages.
- [ ] Convert/write outputs under `docs/static/img/social/`.
- [ ] Add a docs package script if needed.

### Step 2: Expand L1 cards

- [ ] Add social-card frontmatter/assets for selected high-value pages.
- [ ] Prioritize top-level explainers, gardener payouts, operator assessment pages, vault/hypercert pages, glossary, and FAQ.

### Step 3: Refresh adjacent gardener-guide pages

- [ ] Ground `common-errors.mdx` in real error states.
- [ ] Expand `track-status-and-attestations.mdx` with current Work Dashboard behavior.
- [ ] Verify `garden-payouts.mdx` against current payout/vault UI.
- [ ] Consolidate or differentiate `offline-sync-and-drafts.mdx`.

### Step 4: Refresh legacy deck assets

- [ ] Review old community/deck images for stale UI and terminology.
- [ ] Replace, regenerate, or explicitly flag assets that should not be updated yet.

### Step 5: Prevent MDX build breaks

- [ ] Extend docs audit to flag `<https://...>` and `<http://...>` autolinks in markdown/MDX.
- [ ] Run the docs audit/build gate.

### Step 6: Detect drift

- [ ] Flag screenshots older than the last relevant admin/client package bump.
- [ ] Flag social cards older than the page they describe.
- [ ] Flag `.mdx` files with `last_verified` older than 90 days.

## Lane Checklists

### UI (`claude/ui/docs-freshness-routine`)

- [x] Mark this lane `n/a` unless a specific docs visual QA pass is promoted.

### State / API (`codex/state-api/docs-freshness-routine`)

- [ ] Pick exactly one work family before editing.
- [ ] Keep changes inside docs/scripts/assets for the selected family.
- [ ] Run the lightest docs validation that proves the change.
- [ ] Write `handoffs/codex-state-api.md`.

### Contracts (`codex/contracts/docs-freshness-routine`)

- [x] Mark this lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/docs-freshness-routine`)

- [ ] Confirm the routine stayed within one work family.
- [ ] Confirm visual assets were generated from real surfaces.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/docs-freshness-routine`)

- [ ] Re-run the docs validation used by the implementation lane.
- [ ] Confirm status/history reflects the actual routine outcome.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] Relevant docs audit/build command for touched files.
- [ ] `node scripts/plan-hub.mjs validate`
