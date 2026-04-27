# Admin Polish Bundle

**Slug**: `admin-polish-bundle`
**Status**: `DONE`
**Created**: `2026-04-25`
**Priority**: `p3`
**Branch**: per-item — see Items section. Run independent worktrees if parallelizing.

## Closeout — 2026-04-27

Closed after `qa_pass_1` and Codex `qa_pass_2` both passed. Nav fail-open, tooltip/icon-only coverage, Remixicon consistency, settings-only wide `RightSheet`, and the latest CommunityTab Storybook blocker cleanup are verified. Afo's April 28 visual pass is final manual signoff, not an active blocker for this hub.

## Scheduling Update — 2026-04-26

Target: **2026-04-28**. Near-term admin polish target: complete by 2026-04-28, keeping each item independently dispatchable.

## Plan Alignment Update — 2026-04-26

This update is plan hygiene only. It does not perform implementation, browser QA, visual signoff, or plan closeout.

Keep this plan separate from `admin-ux-padding-compounding` and `admin-sheet-animation-retune`, but close all three through one combined admin QA evidence bundle. The April 28 closeout should use:

- Combined admin QA bundle across the three plans.
- Full padding view sweep owned by the padding plan.
- Lean screenshot/smoke evidence.
- No full performance trace unless the sheet smoke later shows obvious jank.

For this polish plan, remaining work is future visual signoff for nav first paint, tooltip placement, icon consistency, and the wide account settings sheet.

## Why this exists

Four small admin defects identified across recent feedback (`feedback_admin_audit_2026_04_14`, `project_admin_known_pains_2026_04_19`) that don't warrant their own plan but together push admin from "functional" to "trusted." Each item is independently dispatchable — this hub keeps the rolling polish queue visible.

## Items

### A. Nav flash on first paint
**Branch**: `bug/admin-nav-flash`

- **Symptom**: `NavigationBar` / `AdminAppBar` renders default state and snaps to authenticated state on every session start.
- **Hypothesis**: hydration order — auth resolution arrives after nav has already painted defaults.
- **Approach**: gate first nav paint on auth-resolved state, OR render the nav with a skeleton that matches eventual layout dimensions so the snap is invisible.
- **Files**: `packages/admin/src/components/Layout/`, `AuthProvider` in `packages/shared/src/providers/Auth.tsx` (treat as `critical` per CLAUDE.md criticality matrix — read every touched line).

### B. Missing tooltips on icon-only controls
**Branch**: `chore/admin-tooltip-coverage`

- **Symptom**: icon-only controls (FAB, AppBar actions, toolbar buttons) lack accessible names and hover hints.
- **Approach**: audit `AdminFab`, `AdminAppBar` action slots, `AdminToolbar` icon buttons. Ensure every icon-only button has `aria-label` and a Radix Tooltip wrapper.
- **Files**: `grep -rn 'IconButton\|<button' packages/admin/src/components/` to enumerate; tooltip primitive lives in `@green-goods/shared`.

### C. Icon library inconsistency
**Branch**: `refactor/admin-icon-consolidation`

- **Symptom**: icon weight/style mixes Material Symbols + Lucide + ad-hoc SVGs — visible drift across views.
- **Approach**: consolidate admin icons on Remixicon `Ri*Line` per root `AGENTS.md` while preserving strict M3 component anatomy; replace Lucide, ad-hoc SVG, and stale Material Symbols stragglers per view.
- **Files**: `grep -rn 'lucide-react\|material-symbols\|<svg' packages/admin/src/`. Track count before/after.

### D. RightSheet width too narrow at desktop
**Branch**: `feature/right-sheet-width-variants`

- **Symptom**: `RightSheet` feels cramped at desktop, especially for forms or multi-column content.
- **Approach**: introduce width variants (`default` | `wide`) keyed by content density. Apply where create/edit forms live (Action, Garden, Hypercerts wizards).
- **Files**: `packages/shared/src/components/Canvas/RightSheet.tsx` + admin views consuming it.

## Constraints (apply to all items)

- Strict M3 anatomy in admin.
- Tokens only — no raw `cubic-bezier`, duration, color, or radius literals.
- No console.log — use `logger` from `@green-goods/shared`.
- No `Wagmi`/`useEffect` async without `useAsyncEffect`; no raw `setTimeout` (`useTimeout`); no raw `addEventListener` (`useEventListener`). See `.claude/rules/react-patterns.md`.
- `bun run check:design-tokens && bun run lint:vocab && bun run test` must pass per item.

## Design-System Acceptance — 2026-04-26

- Every item must stay inside the admin design dialect: `CanvasLayout`, strict M3 anatomy, Plus Jakarta Sans, restrained operator cockpit copy, and existing `Admin*` wrappers where they exist.
- Icon-only controls require an accessible name plus tooltip; use Remixicon `Ri*Line` icons and avoid lucide/ad-hoc SVG additions.
- Glass remains limited to the admin `AppBar`; no decorative gradients, gallery language, hero moments, or client-only vocabulary in admin.
- Token-only implementation: generated `--gg-*`, `--color-*`, `--radius-*`, `--spring-*`, and material tokens only. No raw color, radius, duration, or `cubic-bezier` literals.
- Future QA should include focused visual evidence at affected breakpoints through the combined admin evidence bundle. This plan-hygiene pass only runs `node scripts/harness/plan-hub.mjs validate`.

## UI Implementation Update — 2026-04-26

- Status: UI lane ready for QA.
- Review fixes: `CanvasLayout` preserves fail-open shell paint while permissions load, and garden hero back tooltip uses a non-clipped placement.
- Validation: `check:design-tokens`, `lint:vocab`, shared Storybook checks, admin `test:hub`, admin lint, and admin build passed.
- QA still needs visual signoff for nav first paint, tooltip placement, icon consistency, and account settings sheet width.

## Checklist

- [x] A. Nav flash on first paint — fail-open shell paint covered by regression test; visual signoff remains in QA.
- [x] B. Tooltip coverage on icon-only controls — own commit.
- [x] C. Icon library consolidation — own commit.
- [x] D. RightSheet width variants — own commit.

Items A–D are independently dispatchable. If running in parallel, use separate worktrees.

## Remaining QA Signoff

- [x] QA: nav first paint — cold load of `/hub/work` shows the auth spinner then the full `CanvasLayout` shell; no transient default→authenticated nav snap. `useEffectiveToolbarPermissions` fail-open path keeps shell painting; regression test cited in `combined-qa.md`.
- [x] QA: icon-only controls have accessible names and non-clipped tooltip placement. Live DOM at `/hub/work`: 0 `aria-label`-missing icon-only buttons; 4 AppBar tooltips render via CSS hover; AdminFab + garden hero back button use `AdminTooltip` with `bottom-start` placement.
- [x] QA: admin icon treatment is consistent with Remixicon `Ri*Line` usage. Live DOM scan: 9/10 SVGs match Remixicon; 0 lucide / 0 material-symbols matches.
- [x] QA: account settings opens in the wide `RightSheet` variant; profile and notifications stay default width. Live DOM via `open-account-sheet` event: settings → `data-width="wide"` (max 471px); profile + notifications → `data-width="default"` (max 367px).
