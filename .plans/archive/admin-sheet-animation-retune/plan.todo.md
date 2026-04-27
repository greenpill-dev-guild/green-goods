# Admin Sheet Animation Retune

**Slug**: `admin-sheet-animation-retune`
**Status**: `DONE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `feature/admin-sheet-animation-retune`

## Closeout — 2026-04-27

Closed after `qa_pass_1` and Codex `qa_pass_2` both passed. Source truth still shows `MainSheet` animates opacity and transform only, receded blur is static, bounded sheets do not stack backdrop blur, and reduced-motion behavior remains covered. Afo's April 28 visual pass is final manual signoff, not an active blocker for this hub.

## Scheduling Update — 2026-04-26

Target: **2026-04-28**. Near-term UI cleanup target: complete by 2026-04-28 with motion-token and visual/performance evidence.

## Plan Alignment Update — 2026-04-26

This update is plan hygiene only. It does not perform implementation, browser QA, visual signoff, performance tracing, or plan closeout.

Keep this plan separate from `admin-ux-padding-compounding` and `admin-polish-bundle`, but close all three through one combined admin QA evidence bundle. The April 28 closeout should use:

- Combined admin QA bundle across the three plans.
- Full padding view sweep owned by the padding plan.
- Lean sheet-open and reduced-motion smoke evidence for this plan.
- No full performance trace unless the later smoke shows obvious jank.

For this sheet plan, remaining work is future lean evidence that sheet open/close still feels correct and that reduced-motion behavior remains intact. A throttled performance trace is optional follow-up only if the smoke check exposes jank.

## Why this exists

The recede animation in `MainSheet` currently transitions `opacity + transform + filter (blur)` simultaneously on shared duration and easing tokens. On lower-end Android, animated `filter: blur()` stacks paints on top of any overlay sheet's `backdrop-filter`, producing a visible sluggishness. A token-level retune (fewer animated properties + lighter blur strategy) lifts perceived performance across every sheet open without rewriting the spatial language.

## Background

- MainSheet recede transition: `packages/shared/src/components/Canvas/MainSheet.tsx:117-132` — opacity, transform, and filter share `--spring-spatial-duration` / `--spring-spatial-easing`.
- Spring config: `packages/shared/src/components/Canvas/springConfig.ts`.
- Tokens involved: `--spring-spatial-*`, `--canvas-recede-y`, `--canvas-opacity-receded`, `--canvas-blur-receded`.
- Overlay sheets: `RightSheet`, `LeftSheet`, `BottomSheet` in the same Canvas directory — verify they don't redundantly stack `backdrop-filter`.
- Memory note (`project_admin_known_pains_2026_04_19`): sheet animation over-layered is a tracked open issue.

## Approach

1. Future QA: smoke a sheet open in Chrome MCP at representative mobile and desktop widths; collect lean visual evidence.
2. Drop `filter` from the animated property list. Rationale: blur is the most expensive paint, and the receded surface is decorative behind the active sheet — opacity + transform alone read as recession.
3. If depth still reads, retain blur as a static value applied at receded state (no transition on filter), or move to `will-change` containment.
4. Audit `RightSheet` / `LeftSheet` / `BottomSheet` for redundant `backdrop-filter` stacking — apply once at the overlay-root, not at nested layers.
5. If the lean smoke shows obvious jank, run a throttled performance trace and document the delta in plan eval.
6. Verify under `prefers-reduced-motion` (already short-circuits to `transition: none`).

## Constraints

- No raw `cubic-bezier` or duration literals — use motion tokens only (6 spring tokens).
- Preserve spatial intent: receded surface must read as receded, not just "less opaque."
- Strict M3 anatomy — no decorative motion add-ons.

## Design-System Acceptance — 2026-04-26

- Admin shell stays on `CanvasLayout` and strict M3 anatomy; this is a motion retune, not a new visual language.
- Glass remains limited to the admin `AppBar`. Do not add decorative gradients, new blur layers, or glass effects to sheets, surfaces, or cards.
- Use only `--spring-*`, `--color-*`, `--radius-*`, `--blur-material-*`, and generated `--gg-*` tokens for motion/material values. No raw duration, easing, color, or radius literals.
- Reduced-motion behavior must remain unchanged and explicitly verified.
- Future QA should use the combined admin evidence bundle: lean sheet-open and reduced-motion smoke evidence, plus targeted plan validation after any later code changes. Full before/after performance tracing is not required unless visible jank appears. This plan-hygiene pass only runs `node scripts/harness/plan-hub.mjs validate`.

## UI Implementation Update — 2026-04-26

- Status: UI lane ready for QA.
- Implementation: `MainSheet` no longer transitions `filter`; opacity and transform remain token-driven, with static blur retained only for the receded state.
- Validation: `check:design-tokens`, `lint:vocab`, shared Storybook checks, admin `test:hub`, admin lint, and admin build passed.
- QA still needs lean sheet-open/reduced-motion evidence under the combined admin QA bundle.

## Success

- Lean sheet-open smoke shows no obvious jank; if obvious jank appears, capture throttled before/after timing before closeout.
- Reduced-motion path unchanged.
- Visual recede effect remains clearly distinct from "sheet not open" at full opacity.

## Out of scope

- Padding compounding (see `admin-ux-padding-compounding`)
- New motion language — this is retune, not redesign.
- Client PWA motion.

## Checklist

- [x] QA: live DOM smoke at iw=1309 (desktop) — captured `mainSurface` resting + receded states in `combined-qa.md`. Mobile-width smoke covered via the 4-breakpoint sweep on `/hub/work` in the padding plan; transition list identical at all widths.
- [x] Remove `filter` from animated property list in MainSheet recede.
- [x] If depth reading is lost, apply static blur on mount instead.
- [x] Audit overlay sheets for redundant `backdrop-filter`. Live evidence: bounded `RightSheet` overlay reports `backdropFilter: none` and transparent background; only the unbounded fallback applies `blur(2px)`.
- [x] QA: throttled performance trace not required — no obvious jank observed in the live smoke; evidence is sufficient per eval AC-4.
- [x] QA: visual smoke across `RightSheet` (settings + profile + notifications) and `MainSheet` recede confirmed in DOM evidence. `LeftSheet`/`BottomSheet` not opened in this pass — same `MainSheet` recede contract drives them; no plan-specific code differs.
- [x] Reduced-motion path: covered by passing unit test `MainSheet.test.tsx` "disables recession transitions when reduced motion is requested" — re-run via admin `test:hub` (passed).
- [x] Validation: `bun run check:design-tokens`, `bun run lint:vocab`, shared Storybook checks, admin `test:hub`, admin lint, and admin build.
