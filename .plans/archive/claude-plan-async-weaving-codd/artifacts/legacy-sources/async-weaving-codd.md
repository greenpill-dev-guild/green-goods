# Garden View Audit: Remaining Fixes

## Context

The garden detail view (`/gardens/:id`) had a 58-finding audit. 39 were addressed, 5 partially, 13 not done, 1 N/A. This plan covers **14 remaining issues** (skipping 3 low-impact items: 5.2 label casing is intentional, 1.3 edge case at 320px, 6.3 hero loading states are client-side nav).

## Execution Phases

### Phase 1: Extract `useGardenDetailData` hook (Issue 9.2)

**Why**: Detail.tsx is 445 lines with 13+ hooks — hard to follow. Extract all data-fetching into one hook.

**New file**: `packages/admin/src/views/Gardens/Garden/useGardenDetailData.ts`

Move lines 63, 83-172 of Detail.tsx into a `useGardenDetailData(gardenId: string | undefined)` hook:
- All `use*` calls (gardens, assessments, operations, permissions, vaults, cookieJars, strategies, community, pools, createPools, allocations, works)
- Derived values: `canManage`, `canReview`, `canManageRoles`, `weightSchemeLabel`, vault aggregation `useMemo`, `roleMembers`, `roleActions`
- `useDelayedInvalidation` + `queryClient` invalidation setup

Detail.tsx keeps only: UI state (modal open/close, memberToRemove), role icons/labels, JSX rendering.

**Update** `Detail.tsx`: Import and destructure from hook. Remove ~100 lines of hook calls.

---

### Phase 2: Per-file fixes (independent, can be parallelized)

#### 2a. `packages/admin/src/components/StatCard.tsx` — Issue 1.1
- Line 49: `truncate` -> `line-clamp-2` on `<dd>` to allow community value to wrap

#### 2b. `packages/admin/src/components/Garden/AddMemberModal.tsx` — Issues 8.3, 8.6
- Lines 139, 167, 224, 233: `rounded-md` -> `rounded-lg` (match ConfirmDialog)
- Line 122: overlay `z-50` -> `z-60`, `bg-black/30` -> `bg-black/50` (stacking over MembersModal)
- Line 124: content `z-50` -> `z-60`

#### 2c. `packages/admin/src/components/Garden/GardenRolesPanel.tsx` — Issues 5.1, 5.3, 6.2, 4.3
- Line 66: `text-base font-medium` -> `label-md` (typography utility)
- Lines 85-88: Replace plain `<p>` empty state with `<EmptyState icon={<Icon />} title={...} />` (import EmptyState)
- Line 95: `gap-2` -> `gap-3` for delete button spacing; `rounded-md` -> `rounded-lg`

#### 2d. `packages/admin/src/components/Garden/GardenCommunityCard.tsx` — Issues 5.1, 4.3
- Lines 67, 92, 131, 155: h3 headers `text-base font-semibold` -> `label-md`
- Lines 171, 215, 227, 241: inner boxes `rounded-md` -> `rounded-lg`

#### 2e. `packages/admin/src/components/Garden/GardenHeroSection.tsx` — Issue 4.3
- Line 71: outer section `rounded-lg` -> `rounded-xl` (match Card component)
- Line 42: h3 header `text-base font-semibold` -> `label-md`

#### 2f. `packages/admin/src/components/Garden/GardenAssessmentsPanel.tsx` — Issues 9.7, 5.1, 4.3
- Remove hardcoded `EAS_EXPLORER_URL` constant (line 10)
- Import `getEASExplorerUrl` from `@green-goods/shared`
- Add `chainId: number` to props interface
- Line 85: `href={getEASExplorerUrl(chainId, assessment.id)}`
- Line 37: h3 `text-base font-medium` -> `label-md`
- Line 69: inner rows `rounded-md` -> `rounded-lg`

#### 2g. `packages/admin/src/components/Garden/GardenMetadata.tsx` — Issues 1.2, 4.3, 6.6
- Lines 74-81, 131-137: Add 3-tier address display: mobile (6...4), sm (10...8), md+ (full address)
  ```
  <span className="inline sm:hidden">short</span>
  <span className="hidden sm:inline md:hidden">medium</span>
  <span className="hidden md:inline">full</span>
  ```
- Line 58: container `rounded-lg` -> `rounded-xl`
- Lines 27-28: Add `onSuccess` callback to `useCopyToClipboard` calls for toast notification:
  ```ts
  useCopyToClipboard({ onSuccess: () => toastService.success({ title: formatMessage({ id: "app.common.addressCopied" }) }) })
  ```

#### 2h. `packages/admin/src/components/Garden/GardenYieldCard.tsx` — Issues 6.5, 4.3, 5.1
- Add `useState` for `showAllAllocations` boolean
- Show first 5 allocations, then "Show all N" button using `Button` component
- Lines 53, 64, 75, 88, 102, 123: `rounded-md` -> `rounded-lg`
- Line 35: outer container `rounded-lg` -> `rounded-xl`
- Line 42: h3 header `text-base font-semibold` -> `label-md`

#### 2i. `packages/admin/src/components/Work/WorkSubmissionsView.tsx` — Issues 2.5, 5.1
- Lines 32, 37, 42, 47, 59, 117, 149, 153, 161: Rename i18n keys from `admin.work.*` -> `app.admin.work.*`
- Line 57: h3 `text-base font-medium` -> `label-md`

---

### Phase 3: Detail.tsx structural changes (depends on Phase 1)

**File**: `packages/admin/src/views/Gardens/Garden/Detail.tsx`

- **Issue 4.6 — Sticky tab bar**: Wrap `Tabs.Root` around entire layout including PageHeader. Move `Tabs.List` into PageHeader's `children` slot (rendered inside sticky `<header>` at PageHeader.tsx:73).
- **Issue 9.7 propagation**: Pass `chainId={garden.chainId}` to `<GardenAssessmentsPanel>`

---

### Phase 4: i18n keys

**File**: `packages/shared/src/i18n/en.json`

Add/rename keys:
- `"app.admin.work.filter.all"`, `"app.admin.work.filter.pending"`, `"app.admin.work.filter.approved"`, `"app.admin.work.filter.rejected"` (rename from `admin.work.filter.*`)
- `"app.admin.work.submissions.title"`, `"app.admin.work.submissions.empty"`, `"app.admin.work.submissions.empty.all"`, `"app.admin.work.submissions.empty.filtered"` (rename from `admin.work.submissions.*`)
- `"app.yield.showAll": "Show all {count} allocations"` (new)
- `"app.common.addressCopied": "Address copied to clipboard"` (new)
- Remove old `admin.work.*` keys after renaming

---

## Files Modified (12 existing + 1 new)

| File | Issues |
|------|--------|
| **NEW** `useGardenDetailData.ts` | 9.2 |
| `Detail.tsx` | 9.2, 4.6, 9.7 |
| `StatCard.tsx` | 1.1 |
| `AddMemberModal.tsx` | 8.3, 8.6 |
| `GardenRolesPanel.tsx` | 5.1, 5.3, 6.2, 4.3 |
| `GardenCommunityCard.tsx` | 5.1, 4.3 |
| `GardenHeroSection.tsx` | 4.3, 5.1 |
| `GardenAssessmentsPanel.tsx` | 9.7, 5.1, 4.3 |
| `GardenMetadata.tsx` | 1.2, 4.3, 6.6 |
| `GardenYieldCard.tsx` | 6.5, 4.3, 5.1 |
| `WorkSubmissionsView.tsx` | 2.5, 5.1 |
| `en.json` | 2.5, 6.5, 6.6 |

## Reused Utilities
- `getEASExplorerUrl(chainId, attestationId)` — `packages/shared/src/utils/eas/explorers.ts`
- `EmptyState` — `packages/admin/src/components/ui/EmptyState.tsx`
- `useCopyToClipboard({ onSuccess })` — `packages/shared/src/hooks/utils/useCopyToClipboard.ts`
- `toastService` — `packages/shared/src/modules/app/toast.service.tsx`
- Typography CSS utilities (`label-md`) — `packages/admin/src/index.css:283-332`
- `Button` component — `packages/admin/src/components/ui/Button.tsx`

## Verification
1. `bun format && bun lint` — catch any import/style issues
2. `bun run test` — ensure no regressions
3. `bun build` — verify clean build
4. Manual: Open garden detail view, check all 4 tabs render correctly
5. Manual: Dark mode — verify contrast on all modified components
6. Manual: Mobile viewport — verify hero buttons, stat grid, address truncation
7. Manual: Trigger AddMemberModal from MembersModal — verify overlay stacking
