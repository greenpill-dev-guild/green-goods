---
name: data-layer
user-invocable: false
description: Offline-first data layer - job queue, IndexedDB schema, service workers, background sync, storage quotas, draft persistence. Use for offline features, storage design, sync logic, and PWA lifecycle.
version: "1.0.0"
status: active
packages: ["shared", "client"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Data Layer Skill

Unified offline-first data layer guide: job queue, IndexedDB schema design, service workers, background sync, storage quotas, and media management.

> **History**: This skill merges the former `offline` and `storage` skills. All IndexedDB, job queue, service worker, and sync patterns are now in one place.

---

## Activation

When invoked:
- Determine if the feature needs offline support (any blockchain write or IPFS upload does).
- Use the job queue for all write operations — never call contracts directly from UI.
- All IndexedDB operations MUST scope data by `userAddress` for multi-user isolation.
- Check `.claude/context/client.md` for PWA-specific patterns.

---

## Part 1: Job Queue Architecture

### Core Concept

Green Goods is **offline-first**: users can document regenerative work without internet. All write operations go through the job queue, which persists to IndexedDB and syncs when online.

```text
+----------+     +-----------+     +-----------+     +------------+
|  User UI  |---->| Job Queue |---->| IndexedDB |---->| Background |
|  Action   |     |  addJob() |     | Persisted |     |   Sync     |
+----------+     +-----------+     +-----------+     +------------+
                                                           |
                                                     +-----v------+
                                                     | Blockchain  |
                                                     |   + IPFS    |
                                                     +------------+
```

### Job Types

| Kind | Payload | Description |
|------|---------|-------------|
| `"work"` | `WorkJobPayload` | Submit regenerative work on-chain |
| `"approval"` | `ApprovalJobPayload` | Approve submitted work |

### Job Lifecycle

```text
pending -> processing -> completed
                      \-> failed (retry up to 5x with exponential backoff)
```

### Job Queue API

```typescript
import { jobQueue } from "@green-goods/shared";

// Add a job (returns jobId)
const jobId = await jobQueue.addJob(kind, payload, userAddress, meta);

// Process a single job
const result = await jobQueue.processJob(jobId, { smartAccountClient });

// Flush all pending jobs for a user
const flushResult = await jobQueue.flush({ userAddress, smartAccountClient });

// Get queue statistics
const stats = await jobQueue.getStats(userAddress);
// -> { pending, completed, failed, totalJobs }
```

### React Integration

```typescript
import { useJobQueue, JobKind } from "@green-goods/shared";

function SubmitWorkButton({ gardenAddress, actionUID, data }) {
  const { addJob, getJobs, isProcessing } = useJobQueue();

  const handleSubmit = async () => {
    await addJob({
      kind: JobKind.WORK_SUBMISSION,
      payload: { gardenAddress, actionUID, ...data },
      maxRetries: 5,
    });
  };

  const pendingCount = getJobs({ status: "pending" }).length;

  return (
    <button onClick={handleSubmit} disabled={isProcessing}>
      Submit Work {pendingCount > 0 && `(${pendingCount} queued)`}
    </button>
  );
}
```

### Event Subscriptions

```typescript
import { jobQueue } from "@green-goods/shared";

// Subscribe to queue events
const unsubscribe = jobQueue.subscribe((event) => {
  switch (event.type) {
    case "job_added":
      showNotification("Work queued for sync");
      break;
    case "job_completed":
      showNotification("Work submitted successfully");
      break;
    case "job_failed":
      showNotification("Sync failed, will retry");
      break;
  }
});

// Always clean up
return () => unsubscribe();
```

### Retry Strategy

The job queue uses exponential backoff:

| Attempt | Delay | Total Wait |
|---------|-------|------------|
| 1 | 1s | 1s |
| 2 | 2s | 3s |
| 3 | 4s | 7s |
| 4 | 8s | 15s |
| 5 | 16s (capped at 60s) | 31s |

After 5 failures, job is marked `failed` and requires manual retry.

---

## Part 2: IndexedDB Schema Design

### Database Structure

Green Goods uses a single IndexedDB database with multiple object stores:

```text
greenGoodsDB (version N)
  jobs           # Job queue records (pending, processing, completed, failed)
  images         # Offline media files (Blob storage for photos)
  drafts         # Auto-saved form drafts (keyed by form + context)
  preferences    # User settings (locale, theme, notifications)
```

### Object Store Design Principles

| Principle | Pattern | Example |
|-----------|---------|---------|
| **User-scoped keys** | Prefix keys with `userAddress` | `${userAddress}:draft:${gardenId}` |
| **Composite indexes** | Index on [userAddress, status] | Efficient filtered queries |
| **Timestamp fields** | Always include `createdAt`, `updatedAt` | Sort, cleanup, staleness detection |
| **Version field** | Schema version in each record | Forward-compatible migrations |

### Key Patterns

```typescript
// Composite key for user-scoped access
const key = `${userAddress}:${entityType}:${entityId}`;

// Index design for efficient queries
store.createIndex("byUserStatus", ["userAddress", "status"]);
store.createIndex("byUserCreated", ["userAddress", "createdAt"]);

// Never use auto-increment IDs — use deterministic keys
// Deterministic: `${userAddress}:work:${gardenAddress}:${actionUID}`
// Auto-increment: IDs change across devices, can't deduplicate
```

### User-Scoped Data

All IndexedDB operations require `userAddress` for multi-user isolation:

```typescript
// ALWAYS: Scope to user
const jobs = await jobQueue.getJobs(userAddress);

// NEVER: Global job access
const allJobs = await jobQueue.getAllJobs(); // Don't do this
```

---

## Reference Files

For detailed patterns beyond the core job queue and schema design:

- **[storage-lifecycle.md](./storage-lifecycle.md)** -- Schema versioning and migrations, storage quota management, draft persistence, media resource management, data lifecycle (TTL patterns, cross-device considerations), and IndexedDB testing patterns.

- **[service-worker.md](./service-worker.md)** -- Service worker registration, cache strategies per resource type, background sync, SW update flow, Vercel cache headers, connectivity detection, and cross-module event bus communication.

---

## Anti-Patterns

### Job Queue

- **Never call contracts directly from UI** — always use job queue
- **Never assume online** — always check connectivity before direct calls
- **Never skip user scoping** — all IndexedDB ops need `userAddress`

### Storage

- **Never use localStorage for structured data** — use IndexedDB (localStorage is sync, 5MB limit, no indexes)
- **Never use auto-increment keys** — use deterministic composite keys for deduplication
- **Never delete object stores in migrations** — mark as deprecated, clean up later
- **Never store sensitive data unencrypted** — use the crypto service for private keys/tokens
- **Never assume storage is available** — always handle `QuotaExceededError`

### Media & Service Workers

- **Never store large media in localStorage** — use IndexedDB
- **Never forget blob URL cleanup** — use `mediaResourceManager`
- **Never cache service worker aggressively** — use `no-cache` headers

---

## Quick Reference Checklists

### Before Adding Offline Features

- [ ] Write operation goes through job queue (not direct contract call)
- [ ] Job has appropriate `maxRetries` (default: 5)
- [ ] Media files stored in IndexedDB (not localStorage)
- [ ] Blob URLs tracked via `mediaResourceManager`
- [ ] Form drafts auto-saved with `useDraftAutoSave`
- [ ] Storage quota checked for critical threshold
- [ ] Events emitted via event bus for UI updates
- [ ] User address scopes all data access

### Before Modifying IndexedDB Schema

- [ ] Version number incremented
- [ ] Migration function handles all previous versions
- [ ] Version changelog updated
- [ ] Tests cover fresh install AND each upgrade path
- [ ] Existing data preserved through migration
- [ ] Indexes match query patterns

---

## Decision Tree

```text
What data layer work?
|
+-- Offline write operation? ---------> Part 1: Job Queue
|                                        -> addJob() with retry strategy
|                                        -> React hook integration
|
+-- New data type to store? ----------> Part 2: Schema Design
|                                        -> Add object store or extend existing
|                                        -> Define indexes for query patterns
|
+-- Schema change needed? ------------> storage-lifecycle.md: Schema Versioning
|                                        -> Increment DB_VERSION
|                                        -> Write migration function
|                                        -> Test upgrade paths
|
+-- Storage running low? -------------> storage-lifecycle.md: Quota Management
|                                        -> Check quota thresholds
|                                        -> Run tiered cleanup
|
+-- Service worker issue? ------------> service-worker.md: Service Worker
|                                        -> Cache strategy selection
|                                        -> Background sync setup
|
+-- Form needs auto-save? ------------> storage-lifecycle.md: Draft Persistence
|
+-- Photo/media handling? ------------> storage-lifecycle.md: Media Resources
|                                        -> Blob URL tracking
|                                        -> Offline-safe upload flow
|
+-- Data cleanup/lifecycle? ----------> storage-lifecycle.md: Data Lifecycle
|                                        -> TTL patterns
|                                        -> Cross-device considerations
|
+-- Testing storage? -----------------> storage-lifecycle.md: Testing
                                         -> Use fake-indexeddb
                                         -> Test migration paths
```

## Related Skills

- `web3` — Transaction patterns that the job queue wraps
- `error-handling-patterns` — Categorizing sync failures
- `react` — State management for offline indicators
- `monitoring` — Storage quota monitoring and alerting
- `migration` — Cross-package migrations that may include IndexedDB schema changes
- `testing` — Mock patterns for IndexedDB in Vitest
- `performance` — Storage performance and memory management
