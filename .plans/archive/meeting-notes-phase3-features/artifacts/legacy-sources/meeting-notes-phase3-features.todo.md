# Meeting Notes — Phase 3: Features

**Status**: READY
**Created**: 2026-03-26
**Parent**: `.plans/meeting-notes-extraction-march-2026.md`
**Depends on**: Phase 1 (docs) ✅ + Phase 2 (onboarding UX) ✅ — both complete

---

## C1. Social Activity Feed in Client

**Priority**: Highest operator demand — Regen Avocado: "the only thing people want to do is connect with other people."

### Key Finding
All data already available. `usePlatformStats()` batches `getWorks()`, `getWorkApprovals()`, `getGardenAssessments()`. Admin has `RecentActivitySection` component pattern to reuse. No new GraphQL queries needed.

### Files to Create

1. **`packages/shared/src/hooks/garden/useGardenActivityFeed.ts`** — New hook
   - Merges works, approvals, assessments into chronological `ActivityFeedItem[]`
   - Reuses data fetchers from `packages/shared/src/modules/data/eas.ts`
   - Supports `gardenId` scope (single garden) or `gardenIds` (cross-garden)
   - "Load more" via `displayLimit` state (start at 20, increment by 20)
   - Query key: `queryKeys.activityFeed.byGarden(gardenId, chainId)`

2. **`packages/client/src/components/Features/GardenActivityFeed.tsx`** — Feed component
   - Follow `RecentActivitySection` pattern (same icon/color maps from `@remixicon/react`)
   - Activity types: `work_submitted`, `work_approved`, `work_rejected`, `assessment_created`, `gardener_added`
   - Each item: icon + description + relative timestamp + optional thumbnail
   - Tappable → navigates to work/assessment detail
   - "Load more" button at bottom (no infinite scroll for v1)
   - Empty state with description

### Files to Modify

3. **`packages/shared/src/hooks/query-keys.ts`** — Add `activityFeed` section:
   ```ts
   activityFeed: {
     all: ["greengoods", "activityFeed"] as const,
     byGarden: (gardenId: string, chainId: number) =>
       ["greengoods", "activityFeed", "byGarden", gardenId, chainId] as const,
   }
   ```

4. **`packages/shared/src/hooks/garden/useGardenTabs.ts`** — Add `Activity` to `GardenTab` enum (between Work and Insights)

5. **`packages/shared/src/hooks/index.ts`** + **`packages/shared/src/index.ts`** — Barrel exports for `useGardenActivityFeed`

6. **`packages/client/src/views/Home/Garden/index.tsx`** — Render `GardenActivityFeed` in new Activity tab

### i18n Keys (~10 new)
- `app.garden.activity` — "Activity"
- `app.garden.activity.empty` — "No activity yet"
- `app.garden.activity.empty.description` — "Activity will appear as gardeners begin documenting their work."
- `app.garden.activity.loadMore` — "Load more"
- `app.garden.activity.workSubmitted` — "{title} submitted by {gardener}"
- `app.garden.activity.workApproved` — "Work {status} by {operator}"
- `app.garden.activity.assessmentCreated` — "Assessment created for {garden}"
- `app.garden.activity.gardenerJoined` — "{gardener} joined the garden"
- Plus es.json + pt.json translations

### Reference Files
- `packages/admin/src/components/Dashboard/RecentActivitySection.tsx` — component pattern (270 lines)
- `packages/shared/src/hooks/work/usePlatformStats.ts` — data fetching pattern
- `packages/shared/src/types/eas-responses.ts` — data types (`EASWork`, `EASGardenAssessment`, `EASWorkApproval`)

### Verification
- Navigate to garden with existing works in client
- See Activity tab between Work and Insights
- Items sorted newest-first, tappable to detail
- "Load more" works when >20 items
- Empty state displays for gardens with no activity
- `bun format && bun lint && bun run test && bun build`

### Branch
`feature/client-activity-feed`

---

## C2. Cookie Jar Labels + Multi-Asset Awareness

**Priority**: Requested by 2+ operators (Diogo, David) — want to name jars by purpose.

### Key Finding
Contract already supports N jars per garden (one per supported asset). `useGardenCookieJars()` and `CookieJarManageModal` already handle N jars. The gaps are:
1. **Operational**: Only 2 assets (WETH, DAI) in `supportedAssets`. Adding USDC = Safe tx calling `addSupportedAsset()` (not code).
2. **UX**: Jars identified only by asset symbol. Operators want names like "Harvest Rewards", "Education Fund".

### Approach
UI labels stored in garden IPFS metadata. No contract changes.

### Files to Create

1. **`packages/shared/src/hooks/cookie-jar/useCookieJarLabels.ts`** — Read/write labels from garden metadata
   - Garden metadata gets a `cookieJarLabels` field: `Record<string, { label: string; description?: string }>`
   - `getLabel(jarAddress)` reads from metadata
   - `setLabel(jarAddress, label, description?)` updates metadata via `updateGarden`

### Files to Modify

2. **`packages/shared/src/types/cookie-jar.ts`** — Add optional `label`/`description` to `CookieJar` type

3. **`packages/shared/src/hooks/cookie-jar/useGardenCookieJars.ts`** — Merge labels from metadata after fetching jars from contract

4. **`packages/admin/src/components/Work/CookieJarManageModal.tsx`** — Add inline label editing:
   - Small edit icon next to jar name
   - Inline input or small modal for setting label
   - Save persists to IPFS metadata

### i18n Keys (~6 new)
- `app.cookieJar.label` — "Jar label"
- `app.cookieJar.labelPlaceholder` — "e.g., Harvest Rewards, Education Fund"
- `app.cookieJar.labelHint` — "Labels help identify the purpose of each jar"
- `app.cookieJar.editLabel` — "Edit label"
- `app.cookieJar.saveLabel` — "Save"
- `app.cookieJar.labelSaved` — "Jar label updated"
- Plus es.json + pt.json translations

### Reference Files
- `packages/contracts/src/modules/CookieJar.sol` — lines 49-53, 125-152 (multi-jar structure)
- `packages/admin/src/components/Work/CookieJarManageModal.tsx` — already maps over N jars
- `packages/shared/src/hooks/cookie-jar/useGardenCookieJars.ts` — jar fetching (multi-jar ready)
- `packages/shared/src/hooks/garden/useUpdateGarden.ts` — IPFS metadata update mechanism

### Verification
- Open garden detail in admin, see cookie jars with default names (asset symbols)
- Click edit on a jar, enter a label
- Label persists after page refresh (loaded from IPFS metadata)
- `bun format && bun lint && bun run test && bun build`

### Branch
`feature/cookie-jar-labels`

### Future (Contract Upgrade — Deferred)
Per-domain jar mapping: `mapping(address => mapping(Domain => address)) gardenDomainJars` in CookieJarModule. Would allow operators to assign specific jars to specific work domains. Requires dedicated sprint with contract upgrade, migration script, and admin UI.

---

## Execution

```
C1 (activity feed) first — higher priority, independent of C2
C2 (cookie jar labels) second — can be parallelized if desired
```

Both items are independent and can be implemented on separate branches.
