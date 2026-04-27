# Admin Padding Compounding

**Slug**: `admin-ux-padding-compounding`
**Status**: `DONE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `feature/admin-padding-compounding`

## Closeout — 2026-04-27

Closed after `qa_pass_1` and Codex `qa_pass_2` both passed. The `/actions` MainSheet grid overflow and pulled-in `AdminTabRail` narrow-width follow-up are fixed and covered by validation. Afo's April 28 visual pass is final manual signoff, not an active blocker for this hub.

## Scheduling Update — 2026-04-26

Target: **2026-04-28**. Near-term UI cleanup target: complete by 2026-04-28 with design-token and breakpoint evidence.

## Plan Alignment Update — 2026-04-26

This update is plan hygiene only. It does not perform implementation, browser QA, visual signoff, or plan closeout.

Keep this plan separate from `admin-sheet-animation-retune` and `admin-polish-bundle`, but close all three through one combined admin QA evidence bundle. The April 28 closeout should use:

- Combined admin QA bundle across the three plans.
- Full padding view sweep.
- Lean screenshot/smoke evidence.
- No full performance trace unless the later sheet smoke shows obvious jank.

For this padding plan, remaining work is evidence for a full admin view sweep across Hub, Garden, Actions, Hypercerts, Vault, and Community. If the sweep finds visible regressions, fix those in a later implementation pass; this plan update does not make those fixes.

## Why this exists

Across admin views, content nests through `MainSheet → Surface → Surface → Card`, and each layer adds its own padding. The result feels cramped on mobile and wastes horizontal space at desktop. One careful pass through the canvas wrappers lets every admin view inherit the fix without per-view edits.

## Background

- `MainSheet` at `packages/shared/src/components/Canvas/MainSheet.tsx` — sets layout width and inner radius (`1.25rem`)
- Admin Surface / Card wrappers live under `packages/admin/src/components/`
- Hub view is the densest victim: `packages/admin/src/views/Hub/` (recently decomposed from 1376→605 LOC, see git log)
- Concentricity rule from design language: `child_radius = parent_radius − padding`

## Approach

1. Inventory every wrapper that sets padding inside MainSheet's content tree (`grep -rn 'data-component=' packages/admin/src/components/` plus `packages/shared/src/components/Canvas/`).
2. Define one canonical padding contract per nesting depth (Sheet → Surface → Card), encoded as design tokens. Use existing spacing scale; no raw px.
3. Apply concentricity rule when adjusting radii at each layer.
4. Fix Hub first (highest density); then sweep Garden, Action, Hypercerts, Vault, Community.
5. Visually verify in Storybook + Chrome MCP at 375 / 768 / 1024 / 1440.

## Constraints

- Do **not** add Tailwind utility classes inside `packages/shared/src/` for new layout — silent scan failure. See CLAUDE.md "Known Gotchas". Use inline styles or token-driven CSS in shared; keep Tailwind utilities in admin/client.
- Strict M3 anatomy in admin — no glass on Surface or Card. (Glass only on `AdminAppBar`.)
- All motion via spring tokens; no hardcoded `cubic-bezier` or duration literals.
- Tokens: prefer existing `--spacing-*` / `--radius-*` from `packages/shared/src/styles/theme.css`.

## Design-System Acceptance — 2026-04-26

- Admin remains a restrained operator cockpit: `CanvasLayout`, admin `AppBar` glass only, strict M3 anatomy, Plus Jakarta Sans, and existing `Admin*` wrappers where applicable.
- Use Remixicon `Ri*Line` icons if icon-only controls are touched; do not introduce lucide or ad-hoc SVG icons.
- Token-only implementation: use generated `--gg-*`, `--color-*`, `--radius-*`, `--spring-*`, and runtime aliases. No raw color, radius, duration, or `cubic-bezier` literals.
- Preserve concentricity: child radius equals parent radius minus padding, and every padding change must make the nesting contract clearer.
- Future QA should use the combined admin evidence bundle: screenshots at 375 / 768 / 1024 / 1440, plus targeted plan validation after any later code changes. This plan-hygiene pass only runs `node scripts/harness/plan-hub.mjs validate`.

## UI Implementation Update — 2026-04-26

- Status: UI lane ready for QA.
- Implementation: Hub results shell is layout-only, `surface-section` owns the visual treatment/padding, and shared/admin modal/form surfaces avoid extra blur-backed material in admin.
- Validation: `check:design-tokens`, `lint:vocab`, shared Storybook checks, admin `test:hub`, admin lint, and admin build passed.
- QA still needs the requested full admin view sweep and breakpoint screenshot pass.

## Success

- Hub at 375px shows content edges aligned with sheet edges (no compounded inset).
- Canonical token contract documented inline in `theme.css` or surface-level component comment (one line, why-not-what).
- No visible compounded-padding regressions in Hub, Garden, Actions, Hypercerts, Vault, and Community at 4 breakpoints.
- `bun run check:design-tokens && bun run lint:vocab && bun run test` pass.

## Out of scope

- Visual refresh of typography, color, or component vocabulary
- Sheet animation work (see `admin-sheet-animation-retune`)
- Client PWA padding (admin-only pass)

## Checklist

- [x] Audit current padding per layer (Sheet, Surface variants, Card variants).
- [x] Define canonical token contract (one tier per layer).
- [x] Apply to MainSheet / Surface / Card primitives.
- [x] Sweep Hub.
- [x] QA: sweep Garden, Actions, Vault, and Community at iw=1545 — shells render, no compounded inset at the wrapper level. Hypercerts detail not testable without seeded garden — recorded as data-limited.
- [x] QA: lean DOM evidence captured in `.plans/active/admin-polish-bundle/handoffs/qa-evidence/combined-qa.md`.
- [x] QA: Chrome MCP measurements at iw 460 / 745 / 982 / 1545 (mapped from 375 / 768 / 1024 / 1440 targets) on `/hub/work` — MainSheet contract holds at all four widths.
- [x] Follow-up FIXED: `/actions` MainSheet overflow at iw≤599. Root cause: `workspace-canvas-grid` columns used `1fr` instead of `minmax(0, 1fr)`, so the main grid track auto-sized to intrinsic content. Fix: changed both desktop and mobile column tracks to `minmax(0, 1fr)` in `packages/shared/src/styles/theme.css` (1 token-clean CSS edit). Live re-measurement at iw=460: layout grid resolves to `460px`, MainSheet renders 428px (matches `/hub/work` baseline), no body horizontal scroll. Validation re-run all green.
- [x] Pulled-in follow-up FIXED during Codex qa_pass_2: on `/actions` at iw≤460, `AdminTabRail` now uses shrink-aware flex sizing (`min-w-0`, `overflow-hidden`, mobile-tightened gap/padding, shrink-safe badges) and a new `storybook-ci` regression story. Built Storybook iframe smoke at 460px confirms the rail no longer overflows itself or the viewport.
- [x] Targeted validation suite green.
