# Fix Garden Domain UI & Data Issues

**Status**: ACTIVE
**Created**: 2026-03-24

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fix case mismatch in getGardens() only, not in indexer | Normalizing Garden.id in indexer would break all context.Garden.get() calls across handlers |
| 2 | Always show domain section in hero banner | Prevents catch-22 where operators can't configure domains when none exist |
| 3 | Domain alert is data-driven (no canManage check) | Consistent with existing alert pattern; all alerts show regardless of permissions |
| 4 | SubmitWork links back to garden detail for domain config | Domain editor is a modal on Detail page; deep-linking to it would over-engineer |

## Implementation Steps

### Step 1: P0 — Fix case mismatch in getGardens() domain lookup
**Files**: `packages/shared/src/modules/data/greengoods.ts`
**Change**: Normalize key in `domainMap.get(garden.id.toLowerCase())`

### Step 2: P1 — Fix hero banner domain editor catch-22
**Files**: `packages/admin/src/views/Gardens/Garden/GardenDetailHelpers.tsx`
**Change**: Always show domain row. When empty + canManage, show "No domains configured" + edit CTA. When empty + !canManage, show "No domains" label.

### Step 3: P2 — Make SubmitWork "no actions" alert actionable
**Files**: `packages/admin/src/views/Gardens/Garden/SubmitWork.tsx`
**Change**: Add navigation link back to garden detail for domain configuration

### Step 4: P3 — Add domain alert to useGardenDerivedState
**Files**: `packages/shared/src/hooks/garden/useGardenDerivedState.ts`
**Change**: Add domainMask=0 check to overviewAlerts array

### Step 5: Add i18n keys for new domain UI strings
**Files**: `packages/shared/src/i18n/en.json`, `es.json`, `pt.json`
**Change**: Add keys for domain alerts, empty state, CTA

### Step 6: Validate
- `bun format && bun lint && bun run test && bun build`
