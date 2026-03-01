# Task: Fix Offline Bug

## Trigger

A defect in the offline-first PWA: jobs fail to sync, data disappears after reconnect, stale cache displays, blob URL memory leaks, service worker cache mismatches, or IndexedDB state corruption.

## Acceptance Criteria

The bug is reproduced with a failing test that simulates offline conditions (`vi.spyOn(navigator, "onLine", "get")`). The fix addresses the root cause without breaking online behavior. Offline-to-online transition works correctly (jobs drain, queries invalidate, toasts update). No orphan blob URLs remain after component unmount. `bun run test && bun lint && bun build` passes.

## Decomposition

### Step 1: Reproduce Offline Conditions
**Packages**: `shared` (primary), `client` (secondary)
**Input**: Bug report or user-observed behavior
**Output**: Minimal reproduction steps documented. Identify which layer fails: service worker cache, IndexedDB persistence, job queue processing, query cache, or media resource manager
**Verification**: Can trigger the bug deterministically in dev tools (Network tab offline, Application tab IndexedDB inspection)
**Complexity**: S-M

### Step 2: Write Failing Test
**Packages**: `shared`
**Input**: Reproduction from Step 1
**Output**: Test in `packages/shared/src/__tests__/` using `fake-indexeddb/auto` for IndexedDB simulation, `vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)` for offline state, `renderHook` with QueryClientProvider wrapper for hook testing
**Verification**: `cd packages/shared && bun run test -- path/to/test.test.ts` (must FAIL)
**Complexity**: S-M

### Step 3: Trace Job Queue Flow
**Packages**: `shared`
**Input**: Failing test from Step 2
**Output**: Identify the exact failure point in the chain: `submitWorkToQueue` -> IndexedDB write -> `processWorkJobInline` -> smart account client -> EAS attest -> query invalidation. Check `modules/job-queue/` for queue drain logic, `providers/` for event-driven update wiring (`useJobQueueEvents`)
**Verification**: Add targeted `logger.debug` calls to narrow the failure (remove before committing)
**Complexity**: M

### Step 4: Implement Fix
**Packages**: `shared` (primary), `client` (if UI-layer fix needed)
**Input**: Root cause from Step 3
**Output**: Minimal code change. If fixing job queue: check isMounted guards, timer cleanup, event listener removal. If fixing cache: check query invalidation keys match `queryKeys.*` factory. If fixing media: use `mediaResourceManager.getOrCreateUrl()` with tracking ID and cleanup in useEffect return
**Verification**: `cd packages/shared && bun run test -- path/to/test.test.ts` (must PASS)
**On Failure**: If test still fails, revisit root cause in Step 3 and iterate on fix (max 3 attempts before escalating)
**Complexity**: S-M

### Step 5: Verify Online Behavior
**Packages**: `shared`, `client`
**Input**: Fix from Step 4
**Output**: Existing tests still pass. Online submission flow unaffected. Event-driven updates still fire on `job:completed`
**Verification**: `cd packages/shared && bun run test && cd ../client && bun run test`
**Complexity**: S

### Step 6: Verify Offline-to-Online Sync
**Packages**: `shared`
**Input**: Fix from Step 4
**Output**: Test that simulates: go offline -> submit work -> go online -> verify job drains and query cache updates. Check all four sync triggers: online event, inline processing, service worker message, manual flush
**Verification**: `bun run test && bun lint && bun build`
**Complexity**: S-M

## Edge Cases

- **Service worker cache vs app cache**: The service worker caches assets and API responses independently of TanStack Query. A stale service worker can serve old API responses even when the app thinks it re-fetched. Check `packages/client/public/sw.js` registration and cache invalidation strategy.
- **IndexedDB quota exceeded**: Mobile Safari has aggressive IDB limits (~50MB). When quota is hit, writes silently fail. The job queue must handle `QuotaExceededError` gracefully and surface it to the user.
- **Blob URL lifecycle**: `URL.createObjectURL()` pins the blob in memory until `URL.revokeObjectURL()` is called. Components that create blob URLs for images MUST use `mediaResourceManager` with a tracking ID (`work-draft`, `job-{jobId}`) and call `cleanupUrls(trackingId)` on unmount.
- **Race condition on reconnect**: Multiple tabs may detect `online` simultaneously and all attempt to drain the job queue. The queue must handle concurrent drain attempts idempotently.
- **Stale query cache after sync**: After a job completes, the corresponding query cache entry (`queryKeys.works.merged(gardenId, chainId)`) must be invalidated via `useJobQueueEvents`, not polling.
- **isMounted guard in async hooks**: If a component unmounts while an async operation is in progress, state updates on the unmounted component cause React warnings. Verify cleanup functions in useEffect return values.

## Anti-Patterns

- Fixing the symptom (e.g., adding a retry loop) without identifying the root cause
- Using `setInterval` polling instead of event-driven updates (`useJobQueueEvents`)
- Creating blob URLs with `URL.createObjectURL()` directly instead of `mediaResourceManager`
- Testing only the online path and assuming offline works by symmetry
- Swallowing IndexedDB errors in catch blocks without logging or user notification
- Adding `navigator.onLine` checks in components (belongs in shared hooks/providers)
- Skipping the failing test step (Step 2) and going directly to implementation
