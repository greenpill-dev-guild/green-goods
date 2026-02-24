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

Green Goods is **offline-first**: users can document conservation work without internet. All write operations go through the job queue, which persists to IndexedDB and syncs when online.

```text
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌────────────┐
│  User UI  │────→│ Job Queue │────→│ IndexedDB │────→│ Background │
│  Action   │     │  addJob() │     │ Persisted │     │   Sync     │
└──────────┘     └───────────┘     └───────────┘     └────────────┘
                                                           │
                                                     ┌─────▼──────┐
                                                     │ Blockchain  │
                                                     │   + IPFS    │
                                                     └────────────┘
```

### Job Types

| Kind | Payload | Description |
|------|---------|-------------|
| `"work"` | `WorkJobPayload` | Submit conservation work on-chain |
| `"approval"` | `ApprovalJobPayload` | Approve submitted work |

### Job Lifecycle

```text
pending → processing → completed
                    ↘ failed (retry up to 5x with exponential backoff)
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
// → { pending, completed, failed, totalJobs }
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
├── jobs           # Job queue records (pending, processing, completed, failed)
├── images         # Offline media files (Blob storage for photos)
├── drafts         # Auto-saved form drafts (keyed by form + context)
└── preferences    # User settings (locale, theme, notifications)
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
// ✅ Deterministic: `${userAddress}:work:${gardenAddress}:${actionUID}`
// ❌ Auto-increment: IDs change across devices, can't deduplicate
```

### User-Scoped Data

All IndexedDB operations require `userAddress` for multi-user isolation:

```typescript
// ✅ ALWAYS: Scope to user
const jobs = await jobQueue.getJobs(userAddress);

// ❌ NEVER: Global job access
const allJobs = await jobQueue.getAllJobs(); // Don't do this
```

---

## Part 3: Schema Versioning & Migrations

### Version Upgrade Pattern

IndexedDB uses integer versioning. Each schema change increments the version:

```typescript
const DB_NAME = "greenGoodsDB";
const DB_VERSION = 3; // Increment for each schema change

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Run migrations sequentially from old version to new
      if (oldVersion < 1) migrateV0toV1(db);
      if (oldVersion < 2) migrateV1toV2(db, request.transaction!);
      if (oldVersion < 3) migrateV2toV3(db, request.transaction!);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### Migration Functions

```typescript
// V1: Initial schema — create stores
function migrateV0toV1(db: IDBDatabase) {
  const jobStore = db.createObjectStore("jobs", { keyPath: "id" });
  jobStore.createIndex("byUserStatus", ["userAddress", "status"]);
  jobStore.createIndex("byCreated", "createdAt");

  db.createObjectStore("images", { keyPath: "id" });
  db.createObjectStore("drafts", { keyPath: "key" });
}

// V2: Add preferences store
function migrateV1toV2(db: IDBDatabase, tx: IDBTransaction) {
  db.createObjectStore("preferences", { keyPath: "key" });
}

// V3: Add index to existing store (requires transaction)
function migrateV2toV3(db: IDBDatabase, tx: IDBTransaction) {
  const jobStore = tx.objectStore("jobs");
  jobStore.createIndex("byKind", ["userAddress", "kind"]);
}
```

### Migration Rules

| Rule | Details |
|------|---------|
| **Always increment version** | Never reuse a version number |
| **Migrations are additive** | Never delete stores in upgrades (handle in cleanup) |
| **Use the transaction** | `onupgradeneeded` provides a versionchange transaction — use it for data transforms |
| **Test each migration path** | Test V1→V3, V2→V3, and fresh V3 installs |
| **Keep migration history** | Document each version's changes in a changelog |

### Version Changelog Pattern

```typescript
/**
 * Schema Version History:
 *
 * V1 (2025-06-01): Initial schema
 *   - jobs: Job queue records with byUserStatus index
 *   - images: Offline media blobs
 *   - drafts: Auto-saved form data
 *
 * V2 (2025-09-15): User preferences
 *   - preferences: Locale, theme, notification settings
 *
 * V3 (2026-01-20): Job kind filtering
 *   - jobs: Added byKind index for filtering by job type
 */
```

---

## Part 4: Storage Quota Management

### Quota Detection

```typescript
import { getStorageQuota } from "@green-goods/shared";

const quota = await getStorageQuota();
// → { used: 45MB, quota: 100MB, percentUsed: 45, isLow: false, isCritical: false }

if (quota.isCritical) {
  // > 90% — prompt user to sync or clear old data
  showStorageWarning();
}

if (quota.isLow) {
  // > 75% — show indicator
  showStorageIndicator();
}
```

### Tiered Cleanup Strategy

When storage is low, clean in priority order (least valuable first):

```typescript
async function tieredCleanup(userAddress: Address): Promise<CleanupResult> {
  const quota = await getStorageQuota();
  const result: CleanupResult = { freedMB: 0, actions: [] };

  // Tier 1: Clean completed jobs older than 30 days
  if (quota.percentUsed > 75) {
    const freed = await cleanCompletedJobs(userAddress, 30);
    result.freedMB += freed;
    result.actions.push("Cleaned old completed jobs");
  }

  // Tier 2: Clean orphaned media (no matching job)
  if (quota.percentUsed > 80) {
    const freed = await cleanOrphanedMedia(userAddress);
    result.freedMB += freed;
    result.actions.push("Cleaned orphaned media");
  }

  // Tier 3: Clean stale drafts older than 7 days
  if (quota.percentUsed > 85) {
    const freed = await cleanStaleDrafts(userAddress, 7);
    result.freedMB += freed;
    result.actions.push("Cleaned stale drafts");
  }

  // Tier 4: User action required
  if (quota.percentUsed > 90) {
    result.actions.push("User intervention required");
  }

  return result;
}
```

### Storage Budget per Store

| Store | Budget | Rationale |
|-------|--------|-----------|
| `jobs` | < 10MB | Text records, compact |
| `images` | < 50MB | Photos compressed, rotated out after upload |
| `drafts` | < 5MB | Auto-saved form data, short-lived |
| `preferences` | < 1MB | Key-value settings |
| **Total target** | < 66MB | Leave headroom for browser overhead |

---

## Part 5: Service Worker Lifecycle

### Registration

```typescript
import { ServiceWorkerManager } from "@green-goods/shared";

const swManager = new ServiceWorkerManager();
await swManager.register();  // Registers /sw.js
```

### Cache Strategies

Green Goods uses different strategies per resource type:

| Resource | Strategy | Why |
|----------|----------|-----|
| App shell (HTML) | Network-first, cache fallback | Always serve latest, work offline |
| Static assets (`/assets/*`) | Cache-first (immutable) | Hashed filenames, never changes |
| API calls (GraphQL) | Network-only + cache fallback | Fresh data preferred, stale OK offline |
| Images (IPFS) | Cache-first | Content-addressed, never changes |
| Service worker (`/sw.js`) | Network-only | Must always check for updates |

```typescript
// In service-worker.ts
const CACHE_NAME = "green-goods-v1";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Static assets — cache-first (immutable hashed filenames)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // API/GraphQL — network-first with cache fallback
  if (url.pathname.startsWith("/v1/graphql")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell — network-first
  event.respondWith(networkFirst(event.request));
});
```

### Background Sync

When the device comes back online, the service worker triggers a sync:

```typescript
// Request background sync manually
swManager.requestBackgroundSync();

// In service worker: handle sync events
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "job-queue-flush") {
    event.waitUntil(flushPendingJobs());
  }
});
```

### Controller Change Handling

```typescript
// Handle service worker updates (new version available)
// Uses { once: true } to prevent listener leaks (Architectural Rule #2)
navigator.serviceWorker.addEventListener(
  "controllerchange",
  () => window.location.reload(),
  { once: true }
);
```

### SW Update Flow ("New Version Available")

```typescript
import { useServiceWorkerUpdate } from "@green-goods/shared";

function UpdatePrompt() {
  const { hasUpdate, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();

  if (!hasUpdate) return null;

  return (
    <div role="alert" className="fixed bottom-4 right-4 p-4 bg-card rounded-lg shadow-lg">
      <p>A new version is available</p>
      <div className="flex gap-2 mt-2">
        <button onClick={applyUpdate}>Update now</button>
        <button onClick={dismissUpdate} variant="ghost">Later</button>
      </div>
    </div>
  );
}
```

### Vercel Cache Headers

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/assets/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## Part 6: Draft Persistence

### Auto-Save Drafts

Forms auto-save to IndexedDB so users don't lose work:

```typescript
import { useDraftAutoSave, useDraftResume } from "@green-goods/shared";

function WorkForm({ gardenAddress }) {
  const form = useForm();

  // Auto-save every 5 seconds
  useDraftAutoSave({
    key: `work-draft-${gardenAddress}`,
    data: form.getValues(),
    interval: 5000,
  });

  // Resume from saved draft on mount
  useDraftResume({
    key: `work-draft-${gardenAddress}`,
    onResume: (saved) => form.reset(saved),
  });
}
```

---

## Part 7: Media Resource Management

### Blob URL Lifecycle

Prevent memory leaks when handling photos:

```typescript
import { mediaResourceManager } from "@green-goods/shared";

// Create a tracked blob URL
const url = mediaResourceManager.createObjectURL(file);

// Revoke when done (e.g., after upload completes)
mediaResourceManager.revokeObjectURL(url);

// Or revoke all for a specific context
mediaResourceManager.revokeAll(contextId);
```

### Photo Upload Flow (Offline-Safe)

```text
1. User takes photo → stored as blob in IndexedDB
2. Blob URL created for preview (tracked by mediaResourceManager)
3. Job queued with photo reference
4. When online: photo uploaded to IPFS, blob URL revoked
5. On-chain attestation includes IPFS hash
```

---

## Part 8: Data Lifecycle

### Record States

```text
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│  Created  │────→│  Active   │────→│  Synced   │────→│ Archived │
│ (local)   │     │ (pending) │     │ (on-chain)│     │ (cleanup)│
└──────────┘     └───────────┘     └───────────┘     └──────────┘
```

### TTL (Time-To-Live) Patterns

```typescript
interface StorageRecord {
  key: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;  // null = no expiry
  synced: boolean;
}

function getExpiry(kind: string): number | null {
  const TTL = {
    draft: 7 * 24 * 60 * 60 * 1000,           // 7 days
    completedJob: 30 * 24 * 60 * 60 * 1000,    // 30 days
    image: null,                                 // Until synced
    preference: null,                            // Never expires
  };
  return TTL[kind] ? Date.now() + TTL[kind] : null;
}
```

### Cross-Device Considerations

IndexedDB is **device-local** — data doesn't sync between devices:

| Data | Cross-Device Strategy |
|------|-----------------------|
| Jobs | Synced via blockchain — IndexedDB is just the queue |
| Drafts | Lost on device switch (acceptable — drafts are ephemeral) |
| Images | Synced via IPFS — IndexedDB is staging area |
| Preferences | Could sync via user profile on-chain (future) |

---

## Part 9: Connectivity & Event Bus

### Connectivity Detection

```typescript
import { useOffline } from "@green-goods/shared";

function OfflineBanner() {
  const { isOnline } = useOffline();

  if (!isOnline) {
    return (
      <div role="status" className="bg-warning text-warning-foreground p-2 text-center">
        You're offline. Changes will sync when you reconnect.
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div role="status" className="bg-success text-success-foreground p-2 text-center">
        Back online! Syncing changes...
      </div>
    );
  }

  return null;
}
```

### Cross-Module Communication

```typescript
import { eventBus } from "@green-goods/shared";

type QueueEvent =
  | "job:added"
  | "job:processing"
  | "job:completed"
  | "job:failed"
  | "queue:sync-completed"
  | "background:sync-requested";

// Subscribe in React
import { useJobQueueEvents } from "@green-goods/shared";

function SyncIndicator() {
  useJobQueueEvents({
    onSyncCompleted: () => toast.success("All work synced!"),
    onJobFailed: (job) => toast.error(`Failed to sync: ${job.id}`),
  });
}
```

---

## Part 10: Testing

### Mock Pattern

```typescript
import { vi } from "vitest";

// Use fake-indexeddb for unit tests
import "fake-indexeddb/auto";

describe("JobQueue Storage", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("greenGoodsDB");
  });

  it("stores and retrieves jobs by user", async () => {
    const db = await openDatabase();
    await storeJob(db, mockJob({ userAddress: "0xabc..." }));

    const jobs = await getJobsByUser(db, "0xabc...");
    expect(jobs).toHaveLength(1);
  });

  it("migrates from V1 to V2", async () => {
    const dbV1 = await openDatabaseAtVersion(1);
    await storeJob(dbV1, mockJobV1());
    dbV1.close();

    const dbV2 = await openDatabaseAtVersion(2);
    expect(dbV2.objectStoreNames).toContain("preferences");

    const jobs = await getJobs(dbV2);
    expect(jobs).toHaveLength(1);
  });
});
```

### What to Test

| Scenario | Test |
|----------|------|
| Fresh install | All stores created, indexes present |
| Version upgrade | Each migration path works (V1→V3, V2→V3) |
| User isolation | User A can't see User B's data |
| Quota exceeded | Graceful degradation, cleanup triggered |
| Concurrent access | Multiple tabs don't corrupt data |
| Expired records | TTL cleanup removes old records |
| Job lifecycle | pending → processing → completed/failed |
| Offline → online | Background sync processes queued jobs |
| Draft persistence | Form data survives page reload |

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
│
├── Offline write operation? ───────► Part 1: Job Queue
│                                      → addJob() with retry strategy
│                                      → React hook integration
│
├── New data type to store? ────────► Part 2: Schema Design
│                                      → Add object store or extend existing
│                                      → Define indexes for query patterns
│
├── Schema change needed? ──────────► Part 3: Schema Versioning
│                                      → Increment DB_VERSION
│                                      → Write migration function
│                                      → Test upgrade paths
│
├── Storage running low? ───────────► Part 4: Quota Management
│                                      → Check quota thresholds
│                                      → Run tiered cleanup
│
├── Service worker issue? ──────────► Part 5: Service Worker
│                                      → Cache strategy selection
│                                      → Background sync setup
│
├── Form needs auto-save? ─────────► Part 6: Draft Persistence
│
├── Photo/media handling? ──────────► Part 7: Media Resources
│                                      → Blob URL tracking
│                                      → Offline-safe upload flow
│
├── Data cleanup/lifecycle? ────────► Part 8: Data Lifecycle
│                                      → TTL patterns
│                                      → Cross-device considerations
│
└── Testing storage? ──────────────► Part 10: Testing
                                      → Use fake-indexeddb
                                      → Test migration paths
```

## Related Skills

- `web3` — Transaction patterns that the job queue wraps
- `error-handling-patterns` — Categorizing sync failures
- `react` — State management for offline indicators
- `monitoring` — Storage quota monitoring and alerting
- `migration` — Cross-package migrations that may include IndexedDB schema changes
- `testing` — Mock patterns for IndexedDB in Vitest
- `performance` — Storage performance and memory management
