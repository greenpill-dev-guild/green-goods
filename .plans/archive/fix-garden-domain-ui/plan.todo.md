# Garden Domain New Admin UI Parity

**Status**: ARCHIVED
**Created**: 2026-03-24
**Last Updated**: 2026-05-02

> 2026-04-27 scope update: the garden-domain UI/data fix has already landed on `main`, but the current admin UI is substantially different. Do **not** cherry-pick those commits. Use the `main` behavior as acceptance reference, then verify or adapt the current new admin UI so the same recovery path exists here.
>
> 2026-05-02 closeout: QA pass 1 verified all in-scope acceptance checks; QA pass 2 is recorded as skipped per accepted targeted-proof closeout.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fix case mismatch in getGardens() only, not in indexer | Normalizing Garden.id in indexer would break all context.Garden.get() calls across handlers |
| 2 | Always show domain section in hero banner | Prevents catch-22 where operators can't configure domains when none exist |
| 3 | Domain alert is data-driven (no canManage check) | Consistent with existing alert pattern; all alerts show regardless of permissions |
| 4 | SubmitWork links back to garden detail for domain config | Domain editor is a modal on Detail page; deep-linking to it would over-engineer |
| 5 | Treat `main` as behavioral reference, not patch source | The current admin UI is different enough that cherry-picking legacy commits would create churn; adapt the behavior to the new UI surface. |

## Implementation Steps

### Step 1: P0 — Verify domain lookup parity in current branch
**Files**: `packages/shared/src/modules/data/greengoods.ts`
**Change**: Confirm the `main` case-insensitive domain lookup behavior exists here. If missing, normalize key in `domainMap.get(garden.id.toLowerCase())` without changing indexer ids.

### Step 2: P1 — Ensure new admin garden detail exposes empty domains
**Files**: `packages/admin/src/views/Gardens/Garden/GardenDetailHelpers.tsx`
**Change**: In the current admin UI, always show the domain row or equivalent domain section. When empty + canManage, show "No domains configured" + edit CTA. When empty + !canManage, show "No domains" label.

### Step 3: P2 — Keep SubmitWork "no actions" recovery path
**Files**: `packages/admin/src/views/Gardens/Garden/SubmitWork.tsx`
**Change**: Ensure the new admin Submit Work empty state links back to the garden detail/domain configuration path.

### Step 4: P3 — Verify derived domain alert
**Files**: `packages/shared/src/hooks/garden/useGardenDerivedState.ts`
**Change**: Confirm a `domainMask=0` check exists in `overviewAlerts`; add it only if missing.

### Step 5: Add i18n keys for new domain UI strings
**Files**: `packages/shared/src/i18n/en.json`, `es.json`, `pt.json`
**Change**: Add keys for domain alerts, empty state, CTA

### Step 6: Validate
- Targeted shared/admin tests for touched surfaces
- `bun run lint:vocab`
- `bun format && bun lint && bun run test && bun build` if the implementation touches shared/admin runtime files broadly
