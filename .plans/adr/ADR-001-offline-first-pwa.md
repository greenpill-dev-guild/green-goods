# ADR-001: Offline-First PWA Architecture

**Date**: 2026-04-02
**Status**: Accepted

## Context

Green Goods documents regenerative work (gardening, composting, land stewardship) that often happens in locations with poor or no connectivity. If users can only submit work evidence while online, they lose the moment -- photos go stale, details fade, and the friction of "try again later" kills adoption. The platform needed to let gardeners capture and queue work evidence at the point of activity, regardless of network state.

## Decision

The client is a Progressive Web App with an IndexedDB-backed job queue (`packages/shared/src/modules/job-queue/index.ts`) and a Service Worker for background sync (`packages/shared/src/modules/app/service-worker.ts`).

Key mechanics:

- **Job queue**: Work and approval submissions are persisted to IndexedDB via `jobQueueDB` immediately. Each job stores its payload, media references, user address, and chain ID. When connectivity returns, `flush()` processes jobs sequentially with exponential backoff (max 5 retries).
- **Synthetic tx hashes**: Offline jobs receive a `0xoffline_` prefixed hash so the UI can navigate to a "pending" state without a real transaction. The `isOfflineTxHash()` guard prevents these from reaching RPC calls.
- **Service Worker**: Registers for Background Sync API (`REGISTER_SYNC` messages) so the OS can wake the app to flush queued jobs even if the tab is backgrounded.
- **Media persistence**: Images are stored alongside jobs in IndexedDB via `mediaResourceManager`, with storage quota monitoring and warnings at low/critical thresholds.
- **Scheduler integration**: Flush processing uses `scheduleTask()` with background priority and yields to the main thread every 3 jobs, preventing UI jank during batch sync.

## Consequences

- **Enables**: Field workers capture evidence instantly; the app feels responsive regardless of connectivity.
- **Constrains**: All mutation paths must go through the job queue rather than direct RPC calls, adding complexity. Media files bloat IndexedDB -- the storage quota monitoring exists to surface this before it becomes a silent failure.
- **Trade-off**: Orphaned jobs (synced but failed to delete) require a cleanup scheduler running every 5 minutes. The failed-delete set is persisted to IndexedDB to survive page reloads.
- **Testing**: Offline paths are harder to test -- requires mocking `navigator.onLine`, IndexedDB, and service worker registration.
