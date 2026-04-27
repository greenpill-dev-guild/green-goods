# Client PWA Design-System Transition Plan

**Feature Slug**: `client-pwa-design-system-transition`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-26`
**Last Updated**: `2026-04-26`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a new backlog hub instead of editing `design-system-alignment-review` | The existing hub is read-only review; this hub plans future migration work. |
| 2 | Treat the outcome as better PWA cohesion, not token parity only | The user wants the PWA to become a better, more cohesive field tool. |
| 3 | Keep one canonical staged hub | Avoid multiple overlapping active plans for one migration surface. |
| 4 | Keep public browser hero out of scope | Browser has a separate dialect and should not blur PWA implementation criteria. |
| 5 | Standardize the existing drawer pattern | Wholesale `DialogShell` migration would create behavior churn beyond the desired PWA pass. |
| 6 | Require screenshots per stage and final installed-phone signoff | Automated checks alone cannot prove mobile PWA quality. |
| 7 | Mark `state_api` and `contracts` as `n/a` | This is visual/runtime token work, not data-layer or contract behavior. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify existing repo patterns to mirror: feature hub structure, PWA dialect, token gates,
  and staged QA evidence folders
- [x] List human judgment points before implementation
- [x] Define out-of-scope browser/admin/shared-token work
- [x] Choose the validation commands future implementation must run
- [x] Add current protected PWA baseline census and stage assignment in `spec.md`
- [ ] Future implementation owner confirms the current baseline before editing source files

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Preserve PWA/browser shell split | `ui` | Check display-mode tests and avoid public/browser files | Planned |
| Tokenize drawer and overlay surfaces | `ui` | Stage 1 | Planned |
| Unify PWA status styling | `ui` | Stage 2 | Planned |
| Align splash/loading motion | `ui` | Stage 3 | Planned |
| Tokenize media overlays and upload progress | `ui` | Stage 4 | Planned |
| Clean lower-risk controls/cards/forms | `ui` | Stage 5 | Planned |
| Record visual evidence | `qa_pass_1` | Stage screenshot notes in `handoffs/qa-evidence/` | Blocked on UI |
| Verify regressions and archive readiness | `qa_pass_2` | Final gate rerun and phone signoff check | Blocked on QA pass 1 |

## Future Stage Checklists

### Stage 1 - Drawer And Overlay Surfaces

- [ ] Confirm current `legacy-runtime` entries for drawer/dialog/work approval files.
- [ ] Standardize `ModalDrawer` and `WorkDashboard` overlay/surface styling around Warm Earth
  material and spring tokens.
- [ ] Tokenize `DraftDialog` overlay/content motion and contrast.
- [ ] Tokenize work approval drawer overlay, slide motion, footer shadow/material, and close
  behavior.
- [ ] Treat `ModalDrawer.maxHeight` as an intentional layout fix if still present; capture
  before/after screenshots for the `TopNav` notifications drawer and `ModalDrawer` long-content
  story.
- [ ] Keep focus traps, escape handling, body scroll lock, and AppBar hiding behavior intact.
- [ ] Remove fixed entries from `scripts/data/design-token-usage-baseline.tsv` only after they are
  actually fixed.
- [ ] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [ ] Commit as `fix(client): tokenize pwa drawer surfaces`.

### Stage 2 - PWA Status Style Map

- [ ] Add or document a client-internal status style map for primary, information, warning,
  success, error, and neutral PWA meanings.
- [ ] Apply the map to `TopNav` and `WorkDashboardIcon`.
- [ ] Apply the map to dashboard tabs, upload sync actions, pending/offline dots, and community
  connection/eligibility indicators.
- [ ] Apply the map to `FormProgress`, notification cards, draft status rows, and
  `styles/animation.css` status animation color usage.
- [ ] Preserve primary green for pending work and active value-flow states.
- [ ] Confirm color is not the only state indicator.
- [ ] Remove fixed baseline entries only after implementation.
- [ ] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [ ] Commit as `fix(client): unify pwa status styling`.

### Stage 3 - Splash And Loading Motion

- [ ] Replace raw `duration-*`, `transition-all`, and local easing choices in splash/loading
  surfaces with spring-token motion.
- [ ] Keep the login flow's reserved height/max-height behavior unless visual QA proves a safer
  alternative.
- [ ] Verify reduced-motion behavior remains respected.
- [ ] Screenshot welcome, loading, username input, info callout, and error states.
- [ ] Remove fixed baseline entries only after implementation.
- [ ] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [ ] Commit as `fix(client): align pwa loading motion tokens`.

### Stage 4 - Media Overlays And Upload Progress

- [ ] Tokenize compression progress, media requirement badge, video error, and recording state.
- [ ] Tokenize `/garden` recording controls in `Garden/index.tsx`, including stop-icon foreground.
- [ ] Tokenize image zoom/video play overlays and use `static-white` foreground over media.
- [ ] Preserve blob URL cleanup, upload source tracking, image compression, and video validation.
- [ ] Screenshot media empty, media preview, video overlay, compression progress, and error states.
- [ ] Remove fixed baseline entries only after implementation.
- [ ] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [ ] Commit as `fix(client): tokenize media overlay feedback`.

### Stage 5 - Lower-Risk Controls, Cards, And Forms

- [ ] Sweep remaining protected-PWA legacy runtime entries in cards, buttons, accordions, profile
  controls, filters, garden details, garden filters, and small form actions.
- [ ] Use spring tokens by behavior type: spatial for movement, effects for color/opacity/focus.
- [ ] Keep routine controls restrained; do not add decorative motion.
- [ ] Screenshot representative cards, buttons, filters, accordion, profile, and draft states.
- [ ] Remove fixed baseline entries only after implementation.
- [ ] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [ ] Commit as `fix(client): finish pwa control token cleanup`.

## Lane Checklists

### UI (`claude/ui/client-pwa-design-system-transition`)

- [ ] Confirm the current design-token baseline before edits.
- [ ] Refresh the `spec.md` protected PWA baseline census if baseline line numbers or files changed.
- [ ] Implement stages in order.
- [ ] Keep each stage to a focused commit.
- [ ] Add i18n for any new user-facing strings.
- [ ] Write `handoffs/claude-ui.md` after future implementation.

### State / API (`codex/state-api/client-pwa-design-system-transition`)

- [x] Marked `n/a` in `status.json`.
- [ ] Reopen only if future implementation requires hook/store/query changes.

### Contracts (`codex/contracts/client-pwa-design-system-transition`)

- [x] Marked `n/a` in `status.json`.
- [ ] Reopen only if scope changes unexpectedly.

### QA Pass 1 (`claude/qa-pass-1/client-pwa-design-system-transition`)

- [ ] Review PWA cohesion, mobile usability, status clarity, and visual regressions.
- [ ] Record screenshots/notes under `handoffs/qa-evidence/`.
- [ ] Verify acceptance criteria from `eval.md`.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/client-pwa-design-system-transition`)

- [ ] Start only after `qa_pass_1` passes.
- [ ] Confirm trigger branch exists: `claude/qa-pass-1/client-pwa-design-system-transition`.
- [ ] Re-run targeted validation and inspect remaining regression risk.
- [ ] Confirm the refreshed protected PWA baseline census is zero, or every remaining protected row
  has a human defer note with rationale and owner.
- [ ] Confirm final installed-phone signoff is recorded before archive.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] Future implementation: `bun run check:design-tokens`
- [ ] Future implementation: `bun run lint:vocab`
- [ ] Future implementation: `bun run check:design-generated`
- [ ] Future implementation: `bun run --filter @green-goods/client test`
- [ ] Future implementation: `bun run --filter @green-goods/client build`
