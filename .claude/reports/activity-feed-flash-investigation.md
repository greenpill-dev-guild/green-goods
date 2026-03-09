# Activity Feed Flash-Then-Disappear Investigation

**Date**: 2026-03-08
**Branch**: `fix/contracts-crosspackage`
**Status**: UNRESOLVED — fixes applied but issue persists

## Problem

The admin dashboard Recent Activity feed shows EAS data (work submissions, assessments, work approvals) briefly on page load, then the data disappears and only garden creation events remain.

## Files Changed

| File | Change | Why |
|------|--------|-----|
| `packages/shared/src/hooks/blockchain/useBaseLists.ts` | Removed `initialData`/`initialDataUpdatedAt` from `createBaseListHook` | These read from an empty query cache during `PersistQueryClientProvider`'s `isRestoring=true` phase, producing a false `data: []` that cascaded downstream |
| `packages/shared/src/hooks/work/usePlatformStats.ts` | Replaced `enabled: gardenAddresses.length > 0` with `enabled: !isRestoring`; added `useRef` for address stabilization; added `getWorkApprovals` to fetch; switched from `Promise.all` to `Promise.allSettled` | The `gardenAddresses`-based `enabled` guard was the direct cause of the data loss cycle. Any re-render producing `gardenAddresses = []` disabled the query, and TQ v5's `placeholderData` cannot retain data when observer's `#lastQueryWithDefinedData` is undefined |
| `packages/admin/src/views/Dashboard/index.tsx` | Added `useIsRestoring()` guard to loading check; passes `workApprovals` to `RecentActivitySection` | Prevents rendering with stale/empty data during IDB cache restoration |
| `packages/admin/src/components/Dashboard/RecentActivitySection.tsx` | Added `workApprovals` prop handling, improved empty state message, added garden-only hint | UI improvements for when EAS data genuinely doesn't exist |

## Root Cause Analysis (from 3-agent investigation)

### Agent 1: Oracle — TanStack Query v5 Internals

**Key finding**: `placeholderData: (prev) => prev` does NOT work when the observer's `#lastQueryWithDefinedData` is `undefined`.

Source: `node_modules/@tanstack/query-core/src/queryObserver.ts:484-521`

The `placeholderData` path requires:
1. `options.placeholderData !== undefined` ✓
2. `data === undefined` ✓
3. `status === 'pending'` ✓

But the callback `(prev) => prev` receives `undefined` as `prev` (from `#lastQueryWithDefinedData` at line 507 which is undefined when the observer never successfully fetched). The guard at line 513 (`if (placeholderData !== undefined)`) then prevents it from being used.

**Key finding 2**: During `isRestoring=true`, the observer sets `_optimisticResults = 'isRestoring'` and `shouldSubscribe = false`. Queries render but do NOT subscribe and do NOT fetch. `fetchStatus` is forced to `'idle'`.

### Agent 2: Render Lifecycle Explorer

**Key finding**: `PersistQueryClientProvider` renders children BEFORE IDB restoration completes. It does NOT block rendering. Children mount with empty cache.

**Auth cascade**: `AuthProvider` recreates `contextValue` (via `useMemo`) when wallet connection state changes (`isConnecting`, `isConnected`, `walletHydrationTimedOut`). This causes all consumers to re-render, including Dashboard.

**No component remount**: `PageTransition` uses stable `key={location.pathname}`. No Suspense boundaries that would re-suspend.

### Agent 3: Invalidation Paths

**Key finding**: No accidental invalidation. Platform stats query `["greengoods", "platform", "stats", chainId]` is never targeted by any `invalidateQueries`, `removeQueries`, or `clear()` call outside of explicit logout.

## The Timing Race (Confirmed Deterministic)

1. `PersistQueryClientProvider` renders children with `isRestoring=true`
2. `useGardens`'s `initialData: () => queryClient.getQueryData(key)` reads **empty cache** → returns `undefined`
3. `placeholderData: (prev) => prev ?? []` produces `[]`
4. `gardens = []` → `gardenAddresses = []` → `usePlatformStats` `enabled: false`
5. IDB restoration completes → gardens hydrate → `gardenAddresses` populates → `enabled: true`
6. Platform stats query fires → EAS data loads → **FLASH of all activity**
7. Auth state settles (wallet, role) → Dashboard re-renders → `gardenAddresses` briefly `[]`
8. `enabled: false` again → TQ returns `data: undefined` → **data disappears**
9. `placeholderData` cannot save it because `#lastQueryWithDefinedData` is `undefined`

## What We Fixed

1. **Removed `initialData`** from `useBaseLists` — eliminates the false cache read during restoration
2. **Removed `enabled: gardenAddresses.length > 0`** — the queryFn already handles empty addresses; `enabled` now only gates on `!isRestoring`
3. **Added `useIsRestoring()` guard** in Dashboard — shows skeleton during IDB restoration

## Why It Still Persists (Hypotheses)

The fixes should address the identified root cause. If the issue persists, investigate these remaining hypotheses:

### H1: Multiple React Query instances
If `@tanstack/react-query` resolves to different copies in `shared` vs `admin` packages, `useIsRestoring()` in shared would read from a DIFFERENT context than the one provided by `PersistQueryClientProvider` in admin. It would always return `false`, making `enabled: !isRestoring` always `true` — same as before.

**How to verify**: Check if `node_modules/@tanstack/react-query` is deduplicated or has multiple copies. Run:
```bash
find node_modules/.bun -name "react-query" -type d | grep "@tanstack+react-query@" | sort -u
```

### H2: The query fires during restoration despite `enabled: !isRestoring`
TQ's `useBaseQuery` checks `isRestoring` internally (line 78-80 of `useBaseQuery.ts`), setting `_optimisticResults = 'isRestoring'` and `shouldSubscribe = false`. But if there's a timing gap where `isRestoring` flips to `false` BEFORE the cache is fully hydrated, queries could fire with empty data.

**How to verify**: Add `console.log('isRestoring:', isRestoring, 'gardens:', gardens.length)` at the top of the Dashboard component to observe the exact sequence.

### H3: Stale closure in queryFn even with `useRef`
The `addressesRef.current` is read when `queryFn` executes. If the query fires immediately when `enabled` becomes `true` (before `gardenAddresses` is populated), the ref holds `[]`. The query succeeds with `works: []` and caches that result. Subsequent renders see cached data with empty works.

**How to verify**: Check the `logger.debug("Platform stats fetched", ...)` output. If `works: 0` but `assessments > 0` or `workApprovals > 0`, this confirms the closure captured empty addresses.

### H4: The data disappearance is actually from a DIFFERENT re-render source
Something other than the auth/role cascade causes the Dashboard to unmount and remount (e.g., a router-level re-render, an error boundary catch, a Suspense re-suspend from a lazy-loaded sibling route).

**How to verify**: Add `useEffect(() => { console.log('Dashboard MOUNTED'); return () => console.log('Dashboard UNMOUNTED'); }, [])` to detect remounts.

### H5: `PersistQueryClientProvider` restores data THEN the query refetches and overwrites with empty
If persisted platform stats (with real data) are restored, then the query immediately refetches (stale data), and the refetch captures `gardenAddresses = []` from the ref, the fresh result (`works: []`) overwrites the persisted data.

**How to verify**: Set `staleTime: Infinity` temporarily on `usePlatformStats` to prevent automatic refetches after restoration. If data persists, this is the cause.

## Next Steps

1. **Add diagnostic logging** (console.log, not logger) at these points:
   - Dashboard: `isRestoring`, `isLoading`, `gardens.length`, `gardenAddresses.length`
   - usePlatformStats: `enabled` value, `isRestoring` value, `addressesRef.current.length` when queryFn runs
   - usePlatformStats: data result counts when queryFn resolves

2. **Check for duplicate TQ instances** (H1) — this is the most likely remaining cause

3. **Try `staleTime: Infinity`** on usePlatformStats temporarily to test H5

4. **Check browser DevTools** → React Query tab → observe the platform stats cache entry lifecycle

## EAS Data Availability

| Chain | Works | Assessments | WorkApprovals |
|-------|-------|-------------|---------------|
| Sepolia (11155111) | 0 | 0 | 0 |
| Arbitrum (42161) | 5 | 1 | 4 |

If running on Sepolia, there is genuinely no EAS data — the feed correctly shows only garden events.
