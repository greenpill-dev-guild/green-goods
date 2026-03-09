# Plan E: Client & Admin Polish

**GitHub Issues**: #426, #434, #411 (residual after Plan A), #412, #414
**Branch**: `fix/contracts-crosspackage` (combined with Plan D)
**Status**: DONE
**Created**: 2026-03-07
**Completed**: 2026-03-08
**Phase**: 3 (after Plans A-C stabilize)
**Depends on**: Plan A (image fallbacks), Plan B (client fixes), Plan C (admin fixes)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Polish comes after bug fixes | Don't polish broken features |
| 2 | Group by view/page, not by issue | Touch each file once |
| 3 | CSS-native tooltips over JS tooltips | Per walkthrough request, simpler |
| 4 | Work/vault counts not added to garden cards | Not available at list level without N+1 queries; added total members + open joining instead |
| 5 | Gardener additions not added to activity feed | Indexer tracks RoleGranted events but no hook exposes them to admin; work approvals added instead |

---

## Issues

### #426 — Client garden/profile UX cleanup ✅

**Walkthrough items bundled here**:
- [x] Profile account text wraps awkwardly (text wrapping making sizing look inconsistent)
- [x] Open gardens section rename (currently "Discover Gardens" — rename section)
- [x] Gardens list needs explicit refresh button (only pull-to-refresh and error retry exist)
- [x] Profile help content review (11 FAQ questions exist, need gardener-focused content pass)

**Changes made**:
1. Fixed text wrapping: `line-clamp-1` → `truncate` + `min-w-0` on grow containers in AccountInfo.tsx and AppSettings.tsx
2. Renamed "Discover Gardens" to "Open Gardens" in both code default messages and en.json
3. Added inline refresh button with spinning icon next to "Gardens" heading in GardensList.tsx
4. Updated 5 FAQ answers for gardener focus (whatIsGreenGoods, whatIsEAS, whoCanSubmitWork, howToGetInvolved, whatIsImpact)

**Files**:
- `packages/client/src/views/Profile/AccountInfo.tsx`
- `packages/client/src/views/Profile/AppSettings.tsx`
- `packages/client/src/views/Profile/GardensList.tsx`
- `packages/shared/src/i18n/en.json`

---

### #434 — Home dashboard card animations ✅

**Changes made**:
1. Normalized `duration-400` → `duration-300` on GardenCard and ActionCard content sections
2. ActionCard: converted static `h-40`/`h-26` to container query responsive heights (`h-26 @[300px]:h-32 @[400px]:h-40`)
3. ActionCard: added `@container` directive and responsive padding (`p-3 @[300px]:p-4 @[400px]:p-5`)

**Files**:
- `packages/client/src/components/Cards/Garden/GardenCard.tsx`
- `packages/client/src/components/Cards/Action/ActionCard.tsx`

---

### #412 — Garden dashboard cards richer stats/tooltips ✅

**Changes made**:
1. Added total member count (deduplicated across operators + gardeners + evaluators) with RiGroupLine icon
2. Added CSS-native tooltips via `title` attribute on member count (shows role breakdown), garden name (shows full name on truncate), and open joining badge
3. Added "Open" badge for gardens with open joining enabled
4. Kept operator count as separate stat for quick scanning

**Files**:
- `packages/admin/src/views/Gardens/index.tsx`

---

### #414 — Recent Activity richer events ✅

**Changes made**:
1. Enhanced `usePlatformStats` to fetch work approvals via `getWorkApprovals()` — now returns accurate `pendingWorks` and `approvedWorks` counts
2. Added `work_approved` events to activity feed with operator address and approval/rejection status
3. Added `gardener_added` activity type with icon/color mapping (ready for when role events are exposed)
4. Added `max-h-[480px] overflow-y-auto` scroll constraint on activity feed
5. Increased default `maxItems` from 8 to 10

**Files**:
- `packages/shared/src/hooks/work/usePlatformStats.ts`
- `packages/admin/src/components/Dashboard/RecentActivitySection.tsx`
- `packages/admin/src/views/Dashboard/index.tsx`

---

## Test Strategy

- Visual regression: Storybook stories for updated components
- i18n: Verify all new/changed keys have entries
- Responsive: Test at mobile, tablet, desktop breakpoints

## Validation

```bash
bun format && bun lint && bun run test && bun build
```

Format: ✅ (3 files auto-fixed)
Lint: ✅ (0 errors, pre-existing warnings only)
TypeScript: ✅ (no new errors in changed files)
Tests: ⚠️ (6 pre-existing failures in unrelated files — job-queue, service worker, conviction mutations, mutation error handler)
