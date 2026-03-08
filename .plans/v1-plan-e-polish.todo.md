# Plan E: Client & Admin Polish

**GitHub Issues**: #426, #434, #411 (residual after Plan A), #412, #414
**Branch**: `polish/v1-ux-cleanup`
**Status**: PLANNED
**Created**: 2026-03-07
**Phase**: 3 (after Plans A-C stabilize)
**Depends on**: Plan A (image fallbacks), Plan B (client fixes), Plan C (admin fixes)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Polish comes after bug fixes | Don't polish broken features |
| 2 | Group by view/page, not by issue | Touch each file once |
| 3 | CSS-native tooltips over JS tooltips | Per walkthrough request, simpler |

---

## Issues

### #426 — Client garden/profile UX cleanup

**Walkthrough items bundled here**:
- Profile account text wraps awkwardly (text wrapping making sizing look inconsistent)
- Open gardens section rename (currently "Discover Gardens" — rename section)
- Gardens list needs explicit refresh button (only pull-to-refresh and error retry exist)
- Profile help content review (11 FAQ questions exist, need gardener-focused content pass)

**Steps**:
1. Fix text wrapping in profile account/settings rows — ensure consistent width constraints
2. Rename "Discover Gardens" / open garden section to "Open Gardens"
3. Add inline refresh button to gardens list (alongside existing pull-to-refresh)
4. Review and update FAQ content in `Help.tsx` for gardener focus
5. Update i18n keys for any copy changes

**Files**:
- `packages/client/src/views/Profile/AccountInfo.tsx`
- `packages/client/src/views/Profile/AppSettings.tsx`
- `packages/client/src/views/Profile/GardensList.tsx`
- `packages/client/src/views/Profile/Help.tsx`
- `packages/client/src/views/Home/GardenList.tsx`
- i18n `en.json`

---

### #434 — Home dashboard card animations

**Verified state**: Action cards use fixed heights (`h-40`/`h-26`) while Garden/Work cards use container queries. Different `duration-*` values (`200` vs `300` vs `400`).

**Steps**:
1. Normalize entrance animations to consistent `duration-300` and `transition-all`
2. Adopt container query heights for action cards (match Garden/Work pattern)
3. Ensure filters, wallet drawer, and work dashboard share consistent initial heights

**Files**:
- `packages/client/src/components/Cards/Garden/GardenCard.tsx`
- `packages/client/src/components/Cards/Work/WorkCard.tsx`
- `packages/client/src/components/Cards/Action/ActionCard.tsx`
- `packages/client/src/views/Home/index.tsx`

---

### #412 — Garden dashboard cards richer stats/tooltips

**Steps**:
1. Add work count, impact certificates minted, vault funds to garden cards
2. Implement CSS-native tooltips (`title` attribute or `::after` pseudo-element) for detail hover
3. Ensure data is available from existing garden/indexer queries

**Files**:
- `packages/admin/src/components/Cards/` — garden card components
- `packages/admin/src/views/Gardens/` — garden list/dashboard

---

### #414 — Recent Activity richer events

**Steps**:
1. Expand activity feed to include: work submissions, assessments, impact certificates, gardener additions, work approvals
2. Implement compact feed layout with consistent card heights
3. Add max-height/scroll constraint to activity section

**Files**:
- `packages/admin/src/views/Dashboard/` or wherever Recent Activity lives
- Shared hooks for activity data aggregation

---

## Test Strategy

- Visual regression: Storybook stories for updated components
- i18n: Verify all new/changed keys have entries
- Responsive: Test at mobile, tablet, desktop breakpoints

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
