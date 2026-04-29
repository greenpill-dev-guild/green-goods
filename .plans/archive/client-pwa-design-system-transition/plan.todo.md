# Client PWA Design-System Transition Plan

**Feature Slug**: `client-pwa-design-system-transition`
**Stage**: `archive`
**Status**: `DONE / ARCHIVED`
**Created**: `2026-04-26`
**Last Updated**: `2026-04-29`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a new backlog hub instead of editing `design-system-alignment-review` | The existing hub is read-only review; this hub plans future migration work. |
| 2 | Treat the outcome as better PWA cohesion, not token parity only | The user wants the PWA to become a better, more cohesive field tool. |
| 3 | Keep one canonical staged hub | Avoid multiple overlapping active plans for one migration surface. |
| 4 | Keep public browser hero out of scope | Browser has a separate dialect and should not blur PWA implementation criteria. |
| 5 | Standardize the existing drawer pattern | Wholesale `DialogShell` migration would create behavior churn beyond the desired PWA pass. |
| 6 | Require screenshots per stage and explicit human-waiver notes for uncaptured manual/device proof | Automated checks alone cannot prove mobile PWA quality, and uncaptured proof must stay visible. |
| 7 | Mark `state_api` and `contracts` as `n/a` | This is visual/runtime token work, not data-layer or contract behavior. |
| 8 | Add Stage 0 plan readiness gate | Lock scope and refresh census before any source edits; surface stale empirical claims early. |
| 9 | Add Stage 1 color foundation before drawer/material work | typography.css global heading override is the likely root cause of dark-mode drift; the status helper is the foundation other stages depend on. |
| 10 | Treat typography.css as the only intentional cross-shell file in scope | The repair affects public browser pages; covered by an explicit smoke check rather than a hidden boundary blur. |
| 11 | Helper CSS must not bypass `check:design-tokens` | A helper that ships raw color/motion silently undoes the gate the hub depends on. |
| 12 | Merge previous Stages 3 and 4 into one loading/media stage | The two share spring-token migration and motion-language work; their distinct QA contracts (reduced-motion vs. overlay-contrast) remain separate sub-criteria. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify existing repo patterns to mirror: feature hub structure, PWA dialect, token gates,
  and staged QA evidence folders
- [x] List human judgment points before implementation
- [x] Define out-of-scope browser/admin/shared-token work
- [x] Choose the validation commands future implementation must run
- [x] Add current protected PWA baseline census and stage assignment in `spec.md`
- [x] Repair plan truth: include `typography.css` foundation file, encode cross-shell carve-out,
  document Stage 0 readiness gate
- [x] Future implementation owner confirms the current baseline before editing source files

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Preserve PWA/browser shell split | `ui` | Check display-mode tests; honor cross-shell carve-out for `typography.css` only | Stage 1-4 source implementation and browser/Storybook evidence complete; final installed-phone proof waived by the human owner on 2026-04-29 |
| Repair global heading color foundation | `ui` | Stage 1 | Complete |
| Unify PWA status styling via `pwaStatusStyles` helper | `ui` | Stage 1 | Complete |
| Tokenize drawer and overlay surfaces | `ui` | Stage 2 | Complete |
| Align splash/loading and media motion | `ui` | Stage 3 | Complete |
| Clean lower-risk controls/cards/forms | `ui` | Stage 4 | Complete |
| Record visual evidence including public-browser smoke | `qa_pass_1` | Stage screenshot notes in `handoffs/qa-evidence/` | Stage 1-4 browser/Storybook evidence recorded; real thumbnail/video overlay proof waived by the human owner on 2026-04-29 |
| Verify regressions and archive readiness | `qa_pass_2` | Final gate rerun and phone signoff/waiver check | Automated gates passed; manual/device proof gaps waived by the human owner on 2026-04-29 |

## Future Stage Checklists

### Stage 0 - Plan Readiness Gate

This stage was completed as readiness evidence before Stage 1 source edits.

- [x] Refresh the protected PWA baseline census in `spec.md` if baseline line numbers or files
  changed since the last update.
- [x] Confirm the working tree is clean (or that any local diff is intentionally scoped to this
  hub); stash unrelated drift rather than absorbing it.
- [x] Confirm the cross-shell carve-out for `typography.css` is acknowledged.
- [x] Confirm `bun run check:design-generated` is the gate that triggers regeneration; do not
  run `bun run design:generate` proactively.
- [x] Run `node scripts/harness/plan-hub.mjs validate` to confirm the hub is internally coherent.
- [x] No Stage 0 commit; this stage produced readiness before Stage 1 source changes.

### Stage 1 - Color Foundation

- [x] Replace the global green heading rule in `packages/client/src/styles/typography.css` with a
  foreground/ink token-backed rule; preserve scoped green only where the design language
  explicitly intends an accent.
- [x] Add a client-internal `pwaStatusStyles` helper exporting class sets for `primary`,
  `information`, `warning`, `success`, `error`, and `neutral`.
- [x] Apply the helper to `TopNav`, `WorkDashboard/Icon`, `WorkDashboard/PendingTab`,
  `WorkDashboard/Drafts` (status portion), `Communication/Progress/Progress`,
  `styles/animation.css`, `RequireAuth`, `Home/index.tsx`, `WalletDrawer/Icon`,
  `Home/Garden/Notifications`, `StandardTabs`, and the status portions of `ConvictionDrawer`.
- [x] Use `primary-action` for text-bearing CTAs that read as text-on-color where Stage 1 changed
  CTA surfaces; no new text-bearing CTA was introduced.
- [x] Preserve bright primary green for active nav, pending work, badges, progress, and value
  flow.
- [x] Confirm color is not the only state indicator.
- [x] Confirm helper CSS keeps `bun run check:design-tokens` clean (no raw color/motion).
- [x] Capture `/`, `/gardens` browser smoke screenshots at 375x812 in light and dark mode for the
  cross-shell repair and record under `handoffs/qa-evidence/stage-1-browser-smoke.md`.
- [x] Remove fixed entries from `scripts/data/design-token-usage-baseline.tsv` only after they
  are actually fixed.
- [x] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [x] Stage commit packaging deferred; no path-scoped commit was requested in this shared dirty
  tree. If packaging is requested later, use `fix(client): unify pwa color foundation`.

### Stage 2 - Drawer And Overlay Surfaces

- [x] Confirm current `legacy-runtime` entries for drawer/dialog/work approval files.
- [x] Standardize `ModalDrawer` and `WorkDashboard` overlay/surface styling around Warm Earth
  material and spring tokens.
- [x] Tokenize `DraftDialog` overlay/content motion and contrast.
- [x] Tokenize work approval drawer overlay, slide motion, footer shadow/material, and close
  behavior.
- [x] Tokenize `ConvictionDrawer` drawer portions (status portions handled in Stage 1).
- [x] Tokenize `Gardeners` dialog overlay (member controls handled in Stage 4).
- [x] Treat `ModalDrawer.maxHeight` as an intentional layout fix if still present; capture
  before/after screenshots for the `TopNav` notifications drawer and `ModalDrawer` long-content
  story.
- [x] Keep focus traps, escape handling, body scroll lock, and AppBar hiding behavior intact.
- [x] Remove fixed entries from `scripts/data/design-token-usage-baseline.tsv` only after they
  are actually fixed.
- [x] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [x] Stage commit packaging deferred; no path-scoped commit was requested in this shared dirty
  tree. If packaging is requested later, use `fix(client): tokenize pwa drawer surfaces`.

### Stage 3 - Loading And Media Motion

- [x] Loading: replace raw `duration-*`, `transition-all`, and local easing in `Splash` and
  `LoadingSplash` with spring-token motion. Preserve reserved height/max-height behavior.
- [x] Loading: verify reduced-motion behavior remains respected by keeping the existing global
  reduced-motion stylesheet guard and using token-backed transition variables.
- [x] Loading: record implementation and Storybook screenshot evidence under
  `handoffs/qa-evidence/stage-3-loading.md`.
- [x] Media: tokenize compression progress, media requirement badge, video error, and recording
  state in `Garden/Media`.
- [x] Media: tokenize `/garden` recording controls in `Garden/index.tsx`, including stop-icon
  foreground.
- [x] Media: tokenize image zoom/video play overlays and use `static-white` foreground over media.
- [x] Media: preserve blob URL cleanup, upload source tracking, image compression, and video
  validation.
- [x] Media: record implementation and Storybook screenshot evidence under
  `handoffs/qa-evidence/stage-3-media.md`; real outdoor-thumbnail/video contrast screenshots were
  waived by the human owner on 2026-04-29.
- [x] Remove fixed baseline entries only after implementation.
- [x] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [x] Stage commit packaging deferred; no path-scoped commit was requested in this shared dirty
  tree. If packaging is requested later, use `fix(client): align pwa loading and media motion`.

### Stage 4 - Lower-Risk Controls, Cards, And Forms

- [x] Sweep remaining protected-PWA legacy runtime entries in cards, buttons, accordions,
  profile controls, filters, garden details, garden filters, draft card details, and small form
  actions; current protected-PWA baseline entries are now zero.
- [x] Use spring tokens by behavior type: spatial for movement, effects for color/opacity/focus.
- [x] Keep routine controls restrained; do not add decorative motion.
- [x] Record representative implementation and Storybook screenshot evidence under
  `handoffs/qa-evidence/stage-4-controls.md`.
- [x] Remove fixed baseline entries only after implementation.
- [x] Run `bun run check:design-generated`; regenerate only if the generated PWA audit is stale.
- [x] Stage commit packaging deferred; no path-scoped commit was requested in this shared dirty
  tree. If packaging is requested later, use `fix(client): finish pwa control token cleanup`.

## Lane Checklists

### UI (`claude/ui/client-pwa-design-system-transition`)

- [x] Run Stage 0 readiness gate before any source edit.
- [x] Confirm the current design-token baseline before edits.
- [x] Refresh the `spec.md` protected PWA baseline census if baseline line numbers or files
  changed.
- [x] Implement Stages 1-4 in order. Source implementation and available local/Storybook visual
  evidence are complete; final installed-phone signoff was waived by the human owner on
  2026-04-29.
- [x] Keep each stage to a focused commit. Packaging was not performed in this shared dirty tree;
  if requested later, stage paths explicitly and avoid unrelated dirty files.
- [x] Add i18n for any new user-facing strings. Stage 1 added no new user-facing strings.
- [x] Write `handoffs/claude-ui.md` after source implementation.

### State / API (`codex/state-api/client-pwa-design-system-transition`)

- [x] Marked `n/a` in `status.json`.
- [x] No reopen needed; Stage 1-4 implementation did not require hook/store/query changes.

### Contracts (`codex/contracts/client-pwa-design-system-transition`)

- [x] Marked `n/a` in `status.json`.
- [x] No reopen needed; Stage 1-4 implementation did not require contract changes.

### QA Pass 1 (`claude/qa-pass-1/client-pwa-design-system-transition`)

- [x] Review PWA cohesion, mobile usability, status clarity, and visual regressions.
- [x] Verify the public-browser smoke (`/`, `/gardens`) confirms typography.css repair did not
  regress browser typography.
- [x] Record screenshots/notes under `handoffs/qa-evidence/`.
- [x] Verify acceptance criteria from `eval.md` that can be proven from local source,
  Storybook, browser smoke, and automated gates.
- [x] Write `handoffs/claude-qa-pass-1.md`.
- [x] Close remaining manual visual proof: real bright outdoor-thumbnail/video-thumbnail overlay
  contrast was waived by the human owner on 2026-04-29 and remains documented as uncaptured proof.

### QA Pass 2 (`codex/qa-pass-2/client-pwa-design-system-transition`)

- [x] Start only after local QA Pass 1 evidence was recorded.
- [x] Resolve trigger branch check: no trigger branch exists locally; QA evidence was recorded
  directly in this shared dirty tree, and no branch-gated handoff remains required for closeout.
- [x] Re-run targeted validation and inspect remaining regression risk.
- [x] Confirm the refreshed protected PWA baseline census is zero, or every remaining protected
  row has a human defer note with rationale and owner.
- [x] Confirm final installed-phone signoff is recorded or human-waived before archive; waived by
  the human owner on 2026-04-29.
- [x] Write `handoffs/codex-qa-pass-2.md` with the final closeout outcome.

## Validation

- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] Future implementation: `bun run check:design-tokens`
- [x] Future implementation: `bun run lint:vocab`
- [x] Future implementation: `bun run check:design-generated`
- [x] Future implementation: `cd packages/shared && bun run check:stories`
- [x] Future implementation: `cd packages/shared && bun run check:story-quality`
- [x] Future implementation: targeted client Vitest via bundled Node
  (`pwaStatusStyles`, `pwaDrawerStyles`, `Media`, `Garden`, `GardensList`, `ENSSection`)
- [x] Future implementation: `bun run --filter @green-goods/client test`
- [x] Future implementation: client TypeScript check via bundled Node (`tsc --noEmit`)
- [x] Future implementation: `bun run --filter @green-goods/client build`
  - Final local build used safe ephemeral dummy values for required Varlock secrets
    (`VITE_PINATA_JWT`, `PINATA_JWT`, `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_SECRET`,
    `AGENT_PUBLIC_ALLOWED_ORIGINS`) and approved root `.env` read. A plain build without those
    values still prompts/fails through Varlock/1Password in this environment.
