# Design System Alignment Review Plan

**Feature Slug**: `design-system-alignment-review`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-08-29`
**Linear Issue**: PRD-644
**Linear Source**: source:plans

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete the old implementation plan; keep this as a review plan | The old sweep had completed code/token enforcement and manual QA moved elsewhere. |
| 2 | Start read-only | Design-system fixes can touch shared tokens, stories, docs, and agent guidance; the review should prove drift before editing. |
| 3 | Use the Claude-owned protocol | `AGENTS.md` names `.claude/skills/design/system-alignment-review.md` as the single source for this review shape. |
| 4 | Treat validators as proof boundaries | Passing validators narrow what can honestly be called drift. |
| 5 | Round 1 ran admin-first (2026-08-29) | Afo asked for an admin-console audit; the protocol + validator set were applied to `packages/admin` only. Client PWA/browser, docs, and agent-guidance surfaces stay open as later rounds. |
| 6 | Fix pass accepted; tracked in this hub with a parent-only Linear mirror (PRD-644) | Afo chose one tracking issue over many and one canonical plan over a second implementation surface. This answers the spec's human judgment point: confirmed drift is batched here, not fixed inline during review rounds. |

## Research / Plan Gate

- [x] Read `.claude/skills/design/system-alignment-review.md`. *(Round 1, 2026-08-29)*
- [x] Record exact source-of-truth order in the review notes. *(In the round-1 report)*
- [ ] Run or explicitly block each validator in `spec.md`. *(Round 1 ran 4/5 — `lint:vocab` not run; vocabulary was out of the admin round's scope. Run it in the next round.)*
- [x] Record file:line evidence for every confirmed drift. *(reports/2026-08-29-admin-cockpit-audit.md)*
- [x] Keep fix recommendations separate from implementation. *(Audit was read-only; accepted actions listed below.)*

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Run the design alignment protocol read-only | `ui` | Step 1 | 🔄 admin done 2026-08-29; client/docs/guidance rounds open |
| Verify generated/token/vocab/story validators before claiming drift | `ui` | Step 2 | 🔄 4/5 green 2026-08-29 (`lint:vocab` pending) |
| Produce bounded findings with evidence and rejected false positives | `ui` | Step 3 | 🔄 admin round delivered (7 confirmed clusters, 6 watchlist, 5 rejected) |
| Avoid state/API and contract work | `state_api` / `contracts` | n/a | ✅ |

## Lane Checklists

### UI (`claude/ui/design-system-alignment-review`)

- [x] Read the required protocol. *(Round 1)*
- [x] Run the validator set from `spec.md`. *(Round 1: 4/5 — `lint:vocab` outstanding)*
- [ ] Review DesignMD sources, runtime tokens, Storybook, admin, client, docs, and agent guidance. *(Admin done — reports/2026-08-29-admin-cockpit-audit.md; remaining surfaces open)*
- [x] Write findings in the protocol format. *(Round 1: confirmed drift / watchlist / rejected / state of health)*
- [ ] Write `handoffs/claude-ui.md`. *(Round-1 findings live in the dated report; write the handoff when the lane closes)*

### Round 2 — Accepted Follow-Through (added 2026-08-29, source: admin audit)

The fix pass Afo accepted from the round-1 audit. Order matters: the guard work (2) locks the line while the migrations (1, 3) land.

- [ ] Retire the parallel shadow ladder (`packages/admin/src/index.css:404-449`); migrate its 11 consumers to `--m3-elevation-*` / `AdminCard`. *(The bare-`shadow-*` usage guard landed with the item below; remaining: delete the ladder, migrate consumers, then add a CSS-definition reappearance guard.)*
- [x] Add the four blind-spot guards to `scripts/design/check-tokens.sh` (bare `shadow-*`; hover/active/group-hover scale+translate; semantic-alias focus rings; `text-*-base`) over the existing TSV baseline + expiry mechanism.
  **Receipt**: commit `14eef2880`, 2026-08-29T20:55Z. Admin-scoped `collect_admin_invariant_hits` merged into the audited-baseline diff; 85 existing hit lines baselined (expiry 2026-12-31; fixing a line forces its entry's deletion via the stale check). RED: synthetic violation file failed `bun run check:design-tokens` with the cockpit-invariant message. GREEN: clean tree passes with the new "admin cockpit invariant sweep passed" line. Client scope untouched by design (lift/press physics are client canon).
- [ ] Keyboard-focus pass: visible indicator on `AdminCheckbox`; focus-within ring on `AdminSearchToolbar`; migrate the 12 raw-alias rings to `--tone-focus-ring`; converge `AdminInlineField`/`AdminTextField` on the canonical ring role; CommandPalette combobox wiring + result focus.
- [ ] Re-true the component canon in one doc PR: `packages/admin/DESIGN.md` § Admin Component Pattern (count, wrapper claim, WorkbenchCard provenance, AdminFab integration line), `docs/docs/builders/packages/admin.mdx` list, `AdminDialog`/`AdminFab` JSDoc.
- [ ] Settle dead/duplicated inventory: decide `AdminBadge`/`AdminFab`/`AdminListItem`; delete dead `WorkCard`/`WorkSubmissionsView`; fold hand-rolled card clones into `AdminCard` and status pills into `StatusBadge` as files are touched; add a multiline `AdminTextField` variant.

### Round 3 — Remaining Review Surfaces (open)

- [ ] Client PWA + public browser surfaces against the protocol (include `lint:vocab`).
- [ ] Docs UI + Storybook + agent-guidance surfaces.

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

Round 1 (2026-08-29, develop): `check:design-generated` ✅ · `check:design-tokens` ✅ · `check:stories` ✅ (260/260) · `check:story-quality` ✅ · `lint:vocab` not run. Receipts in `reports/2026-08-29-admin-cockpit-audit.md`.

- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `bun run lint:vocab`
- [ ] `cd packages/shared && bun run check:stories`
- [ ] `cd packages/shared && bun run check:story-quality`
- [ ] `node scripts/harness/plan-hub.mjs validate`

*(Checkboxes above are for the next full round; round-1 results are recorded in the line + report and are not carried forward as current proof.)*
