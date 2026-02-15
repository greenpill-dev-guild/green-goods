# Offline UX: Fluid Work Submission & Approval

**Status**: In Progress
**Branch**: `feature/hats-protocol-v2` (current)

## Context

Green Goods is an offline-first PWA where gardeners document conservation work in the field — often with poor/no connectivity. The architecture has a solid foundation (IndexedDB job queue, smart polling, optimistic approval UI), but **perceived speed** suffers from connective-tissue gaps: wallet users can't sync queued work, submissions don't appear instantly in lists, queue status vanishes when toasts dismiss, and there's no background sync.

This plan addresses those gaps in priority order, maximizing perceived speed with minimal structural changes.

## Completed

### 1A. Optimistic Work Entry in Lists After Submission -- DONE

**File**: `packages/shared/src/hooks/work/useWorkMutation.ts`

Added `onMutate` optimistic cache insertion following the proven pattern from `useWorkApproval.ts:192-227`:
- Cancels outgoing refetches on `queryKeys.works.merged()`
- Snapshots previous data for rollback
- Inserts optimistic `Work` with `id: "0xoffline_optimistic_${Date.now()}"` and `status: "pending"`
- `onError` rolls back to snapshot

### 1C. "Uploading" Visual State in Work Cards -- DONE

**Files**: `packages/shared/src/components/StatusBadge.tsx`, `packages/client/src/components/Cards/Work/WorkCard.tsx`

- Added `"uploading"` to `WorkStatus` type union
- Added `RiUploadCloud2Line` icon with `animate-pulse` (both semantic and default variants)
- `MinimalWorkCard` detects `0xoffline_` ID prefix and shows "Uploading" instead of "Pending"
- `getStatusColors()` normalization updated to include "uploading"

### 2A. Queue Badge on AppBar Home Tab -- DONE

**File**: `packages/client/src/components/Layout/AppBar.tsx`

- Imports `usePendingWorksCount()` (event-driven, reacts to `job:added`/`job:completed`/`job:failed`)
- Renders count badge on Home tab icon when `pendingCount > 0`
- Badge caps at "9+" for counts > 9

---

## Remaining Work

### Phase 2: Persistent Visibility

#### 2B. Persistent Sync Status Bar

**Problem**: Toasts auto-dismiss after 3-5s. No persistent UI for ongoing sync operations.

**Solution**: Thin bar (h-8) rendered above AppBar showing "Syncing 2 items..." with progress indicator. Auto-hides when queue empties. Also hosts the "Sync All" button for wallet users (1B).

**Files**:
- New: `packages/shared/src/components/SyncStatusBar.tsx` -- Uses `useQueueStatistics()` + `useOffline()`
- `packages/client/src/components/Layout/AppBar.tsx` or client layout wrapper -- Render bar conditionally
- `packages/shared/src/stores/useUIStore.ts` -- Wire `isOfflineBannerVisible` (already stubbed but unused)
- `packages/shared/src/providers/JobQueue.tsx` -- Set banner visible on processing events

**Reuse**:
- `useQueueStatistics()` at `packages/shared/src/hooks/work/useWorks.ts:294`
- `isOfflineBannerVisible` flag in UIStore (exists, just unwired)

**Scope**: M | **Est**: 4-6h

---

### Phase 2 continued: Batched Wallet Sync

#### 1B. Batched Wallet Sync with Explicit "Sync All" Button

**Problem**: `JobQueue.tsx:259,265` guards auto-flush behind `authMode === "passkey"`. Wallet users who queue work offline have no sync path. Sequential auto-flush would be N separate wallet signature prompts.

**Solution**: Use EAS `multiAttest` to batch all queued work submissions into a **single transaction, single wallet signature**. User triggers this via a "Sync All (N)" button in the sync status bar (2B) and Work Dashboard.

**How it works**:
1. Collect all pending work jobs from IndexedDB for current user
2. Upload all media to IPFS in parallel (pre-processing step)
3. Encode all work attestation data
4. Build single `multiAttest` transaction via new `buildBatchWorkAttestTx()` (mirrors existing `buildBatchApprovalAttestTx` at `packages/shared/src/utils/eas/transaction-builder.ts:137`)
5. Single wallet signature prompt
6. Mark all jobs as synced on success

**Separate batches**: Work and approval submissions are separate transactions (different schemas, different IPFS requirements). Approvals already have `useBatchWorkApproval`.

**Files**:
- `packages/shared/src/utils/eas/transaction-builder.ts` -- Add `buildBatchWorkAttestTx()`
- New: `packages/shared/src/hooks/work/useBatchWorkSync.ts` -- Orchestrates: load pending jobs -> upload media -> encode -> batch submit -> mark synced
- `packages/client/src/views/Home/WorkDashboard/index.tsx` -- Add "Sync All" button in Uploading tab header
- `packages/shared/src/modules/job-queue/index.ts` -- Add `getJobsWithImages(userAddress)` helper

**Reuse**:
- `buildBatchApprovalAttestTx` pattern for the new `buildBatchWorkAttestTx`
- `useBatchWorkApproval` pattern for the new `useBatchWorkSync` hook
- Existing `encodeWorkData()` for per-job attestation encoding
- `submitBatchApprovalsDirectly` from `packages/shared/src/modules/work/wallet-submission.ts:589` as template

**Scope**: L | **Est**: 8-12h | **Depends on**: 2B

---

### Phase 3: Background Reliability

#### 3A. Pre-flight Contract Simulation for Passkey Users

**Problem**: Wallet users get pre-flight simulation (gas estimation catches access-control errors immediately). Passkey users skip simulation, queue the job, and only discover failures 5-10s later.

**Solution**: Extract `simulateWorkData()` from `packages/shared/src/modules/work/wallet-submission.ts` into a shared utility. Call it for online passkey users before queueing.

**Files**:
- New: `packages/shared/src/modules/work/simulate.ts` -- Extract simulation logic
- `packages/shared/src/modules/work/wallet-submission.ts` -- Import from new utility
- `packages/shared/src/hooks/work/useWorkMutation.ts` -- Call simulation before queue submission when online

**Scope**: M | **Est**: 4-6h | **Independent**

#### 3B. Background Sync via Service Worker

**Problem**: `packages/shared/src/modules/app/service-worker.ts` registers a SW and has `requestBackgroundSync()` but the sync event handler is not implemented. If user submits offline and closes the app, nothing syncs until they reopen.

**Solution**: Implement the `sync` event handler in the service worker that posts a message to the client, triggering `jobQueue.flush()` via the existing event bus.

**Files**:
- SW source file (Vite PWA plugin config or `sw.js`) -- Add `sync` event listener
- `packages/shared/src/modules/app/service-worker.ts` -- Implement `handleMessage` to trigger flush
- `packages/shared/src/modules/work/work-submission.ts` -- Call `requestBackgroundSync()` after `addJob`

**Note**: Background Sync is Chromium-only (progressive enhancement). Safari/Firefox users rely on the "Sync All" button (1B). Passkey users still auto-flush.

**Scope**: M-L | **Est**: 6-10h | **Depends on**: 1B

---

### Phase 4: Polish

#### 4A. Optimistic-to-Confirmed Transition Animation

When real indexer data replaces an optimistic entry, add a brief green shimmer (200ms) on the card. Pure CSS triggered by a `data-confirmed` attribute set when `work.id` changes from `0xoffline_*` to a real hash.

**Files**: Work card component + CSS utilities
**Scope**: S | **Est**: 2-3h | **Depends on**: 1A, 1C

#### 4B. Per-File Media Upload Progress

Replace the coarse "Uploading media..." toast with "Uploading 2/5 photos..." by adding an `onFileProgress` callback to the IPFS upload function (Storacha).

**Files**: EAS encoders, wallet-submission.ts, toast presets
**Scope**: M | **Est**: 4-6h | **Independent**

---

## Dependency Graph

```
DONE ─────────────────────────────────────
1A (optimistic list)  ──────→ 4A (transition animation)
1C (uploading badge)  ──────→ 4A (transition animation)
2A (appbar badge)      ────── done

REMAINING ────────────────────────────────
2B (sync status bar) ──────→ 1B ("Sync All" button lives here)
1B (batched wallet sync) ──→ 3B (background sync can trigger batch)
3A (pre-flight sim)    ────── independent
4A (transition anim)   ────── independent (prereqs done)
4B (file progress)     ────── independent
```

## Implementation Order (Remaining)

| Step | Item | Scope | Est. Hours | Dependencies |
|------|------|-------|------------|--------------|
| 1 | 2B. Persistent sync status bar | M | 4-6h | None |
| 2 | 1B. Batched wallet sync ("Sync All") | L | 8-12h | 2B |
| 3 | 3A. Pre-flight simulation | M | 4-6h | None |
| 4 | 3B. Background Sync SW | M-L | 6-10h | 1B |
| 5 | 4A. Confirmation animation | S | 2-3h | None (prereqs done) |
| 6 | 4B. Per-file upload progress | M | 4-6h | None |

## Verification

1. **Offline test**: Disable network in DevTools -> submit work -> verify optimistic entry appears instantly -> re-enable -> verify "Sync All" button appears
2. **Batch wallet test**: Queue 3 works offline -> reconnect -> tap "Sync All" -> verify single wallet signature prompt -> all 3 confirmed in one tx
3. **Visual test**: Verify "Uploading" badge -> tap "Sync All" -> "Pending" transition, AppBar badge count decrements, sync bar auto-hides
4. **Passkey test**: Passkey users still auto-flush (existing behavior unchanged)
5. **Run validation**: `bun format && bun lint && bun test && bun build`
6. **Cross-browser**: Test Background Sync in Chrome, verify graceful degradation in Safari/Firefox

## Requirements Coverage

| Requirement | Step | Status |
|-------------|------|--------|
| Submission feels instant | 1A (optimistic list) | **Done** |
| Approval feels instant | Existing (Work.tsx optimisticStatus) | **Done** |
| Offline work visible | 1C (uploading badge) + 2A (appbar badge) | **Done** |
| Persistent sync indicator | 2B (sync bar) | Remaining |
| Wallet sync (single sig) | 1B (batched multiAttest) | Remaining |
| Passkey auto-sync | Existing (JobQueue.tsx auto-flush) | **Done** |
| Background sync | 3B (service worker) | Remaining |
| Pre-flight validation | 3A (simulation) | Remaining |
| Smooth transitions | 4A (animation) + 4B (file progress) | Remaining |
