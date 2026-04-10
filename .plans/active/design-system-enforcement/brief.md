# Design System Enforcement

**Slug**: `design-system-enforcement`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-08`

## Problem

The design skill documents describe a "Warm Glass" system grounded in Material Design 3 and Liquid Glass — 5 material layers, spring motion, spatial depth, glass blur hierarchy. The actual admin UI is uniformly `border border-stroke-soft bg-bg-white shadow-sm` on every surface at every depth. There are 4 overlapping ways to make a card, 8+ shadow variants with no scale, z-index values from `z-30` to `z-[10000]`, 13 modals copy-pasting identical Radix Dialog boilerplate, and typography utilities that exist but go unused in 79% of cases.

The result: every surface looks identical, there's no visual hierarchy, and the UI has no connection to the documented design language.

## Desired Outcome

- One `Surface` component with semantically distinct variants (`ground`, `raised`, `floating`) that produce visually different results
- Glass language applied consistently — not everywhere, but intentionally on navigation, sticky headers, and overlays
- A z-index scale with named tokens that prevents `z-[9999]` arms races
- A `ModalDialog` wrapper that eliminates 13 instances of copy-pasted Radix Dialog boilerplate
- Garden detail rail visible on tablets (768px+), not buried below the fold
- Typography and spacing patterns enforced in new code, migrated in high-visibility views

## Scope Notes

- **In scope**: CSS tokens, Surface component, ModalDialog wrapper, z-index scale, glass application, garden detail tablet layout, typography/spacing for garden tabs + hub + vault
- **Out of scope**: Full 53-file typography migration (guideline, not sweep), new route architecture (that's admin-ui-revamp), contract/indexer changes
- **Relationship to admin-ui-revamp**: Orthogonal. That plan addresses architecture (routes, state, roles). This plan addresses visual primitives. Both execute on `feature/admin-ui-revamp` branch.

## Success Signal

A developer opening the admin dashboard can visually distinguish a ground surface from a raised card from a floating overlay without reading labels. The NavigationBar, PageHeader, and SideSheet share a consistent glass language. New modals are 15 lines instead of 45. Z-index values are self-documenting names, not magic numbers.
