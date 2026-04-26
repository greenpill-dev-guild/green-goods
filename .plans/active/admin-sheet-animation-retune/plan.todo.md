# Admin Sheet Animation Retune

**Slug**: `admin-sheet-animation-retune`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `feature/admin-sheet-animation-retune`

## Why this exists

The recede animation in `MainSheet` currently transitions `opacity + transform + filter (blur)` simultaneously on shared duration and easing tokens. On lower-end Android, animated `filter: blur()` stacks paints on top of any overlay sheet's `backdrop-filter`, producing a visible sluggishness. A token-level retune (fewer animated properties + lighter blur strategy) lifts perceived performance across every sheet open without rewriting the spatial language.

## Background

- MainSheet recede transition: `packages/shared/src/components/Canvas/MainSheet.tsx:117-132` — opacity, transform, and filter share `--spring-spatial-duration` / `--spring-spatial-easing`.
- Spring config: `packages/shared/src/components/Canvas/springConfig.ts`.
- Tokens involved: `--spring-spatial-*`, `--canvas-recede-y`, `--canvas-opacity-receded`, `--canvas-blur-receded`.
- Overlay sheets: `RightSheet`, `LeftSheet`, `BottomSheet` in the same Canvas directory — verify they don't redundantly stack `backdrop-filter`.
- Memory note (`project_admin_known_pains_2026_04_19`): sheet animation over-layered is a tracked open issue.

## Approach

1. Profile a sheet open in Chrome MCP DevTools with CPU throttled to 4× — record current frame timings as baseline.
2. Drop `filter` from the animated property list. Rationale: blur is the most expensive paint, and the receded surface is decorative behind the active sheet — opacity + transform alone read as recession.
3. If depth still reads, retain blur as a static value applied at receded state (no transition on filter), or move to `will-change` containment.
4. Audit `RightSheet` / `LeftSheet` / `BottomSheet` for redundant `backdrop-filter` stacking — apply once at the overlay-root, not at nested layers.
5. Re-profile and document delta in plan eval.
6. Verify under `prefers-reduced-motion` (already short-circuits to `transition: none`).

## Constraints

- No raw `cubic-bezier` or duration literals — use motion tokens only (6 spring tokens).
- Preserve spatial intent: receded surface must read as receded, not just "less opaque."
- Strict M3 anatomy — no decorative motion add-ons.

## Success

- Frame budget on sheet open improves measurably under throttled Chrome MCP (record before/after).
- Reduced-motion path unchanged.
- Visual recede effect remains clearly distinct from "sheet not open" at full opacity.

## Out of scope

- Padding compounding (see `admin-ux-padding-compounding`)
- New motion language — this is retune, not redesign.
- Client PWA motion.

## Checklist

- [ ] Capture baseline frame timings on sheet open (throttled CPU).
- [ ] Remove `filter` from animated property list in MainSheet recede.
- [ ] If depth reading is lost, apply static blur on mount instead.
- [ ] Audit overlay sheets for redundant `backdrop-filter`.
- [ ] Re-profile; record delta.
- [ ] Visual QA across Right / Left / Bottom + main recede.
- [ ] Validation: `bun run check:design-tokens && bun run test`.
