# Storage Lifecycle & Management

Schema versioning, migrations, storage quota management, draft persistence, media resources, data lifecycle, and testing patterns for IndexedDB.

---

## Schema Versioning & Migrations

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
| **Test each migration path** | Test V1->V3, V2->V3, and fresh V3 installs |
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

## Storage Quota Management

### Quota Detection

```typescript
import { getStorageQuota } from "@green-goods/shared";

const quota = await getStorageQuota();
// -> { used: 45MB, quota: 100MB, percentUsed: 45, isLow: false, isCritical: false }

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

## Draft Persistence

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

## Media Resource Management

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
1. User takes photo -> stored as blob in IndexedDB
2. Blob URL created for preview (tracked by mediaResourceManager)
3. Job queued with photo reference
4. When online: photo uploaded to IPFS, blob URL revoked
5. On-chain attestation includes IPFS hash
```

---

## Data Lifecycle

### Record States

```text
+-----------+     +----------+     +----------+     +---------+
|  Created  |---->|  Active  |---->|  Synced  |---->| Archived|
| (local)   |     | (pending)|     | (on-chain)|    | (cleanup)|
+-----------+     +----------+     +----------+     +---------+
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

## Testing

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
| Version upgrade | Each migration path works (V1->V3, V2->V3) |
| User isolation | User A can't see User B's data |
| Quota exceeded | Graceful degradation, cleanup triggered |
| Concurrent access | Multiple tabs don't corrupt data |
| Expired records | TTL cleanup removes old records |
| Job lifecycle | pending -> processing -> completed/failed |
| Offline -> online | Background sync processes queued jobs |
| Draft persistence | Form data survives page reload |
