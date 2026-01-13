# Offline Sync Debugger Skill

Debug offline-first issues including job queue, IndexedDB, and Service Worker problems.

## Activation

Use when:
- Work submissions not syncing
- Data inconsistencies after offline period
- Service Worker issues
- User reports offline problems

## Green Goods Offline Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client PWA                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Job Queue  │  │  IndexedDB  │  │   Service   │ │
│  │  (Zustand)  │  │  (Storage)  │  │   Worker    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          │                          │
│                    ┌─────▼─────┐                    │
│                    │   Sync    │                    │
│                    │  Manager  │                    │
│                    └─────┬─────┘                    │
└──────────────────────────┼──────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Indexer   │
                    │   (API)     │
                    └─────────────┘
```

## Process

### Phase 1: Job Queue Inspection

```typescript
// Access job queue state
import { useJobQueue } from "@green-goods/shared";

// Or directly via store
import { useJobQueueStore } from "packages/shared/src/stores/useJobQueueStore";
const state = useJobQueueStore.getState();
```

Check for:
- Pending jobs that should have synced
- Failed jobs with retry counts
- Stuck jobs (in_progress for too long)

### Phase 2: IndexedDB Analysis

Using Chrome DevTools or programmatically:

```javascript
// List all databases
const databases = await indexedDB.databases();

// Open Green Goods database
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open("green-goods");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// List object stores
console.log(db.objectStoreNames);
```

Check for:
- Orphaned data (no corresponding server record)
- Stale data (not updated after sync)
- Corrupted entries

### Phase 3: Service Worker Status

```javascript
// Check registration
const registration = await navigator.serviceWorker.getRegistration();
console.log(registration?.active?.state);

// Check for updates
registration?.update();
```

Common issues:
- Old SW version cached
- SW not activating
- Cache invalidation problems

### Phase 4: Network Sync Analysis

Check sync behavior:

```typescript
// Online status
const isOnline = navigator.onLine;

// Pending sync tasks
const registration = await navigator.serviceWorker.ready;
const tags = await registration.sync.getTags();
```

### Phase 5: Common Issues Checklist

| Issue | Symptom | Check | Solution |
|-------|---------|-------|----------|
| Job stuck | Work not appearing | Queue state | Clear/retry job |
| Stale data | Old data showing | IndexedDB | Force refresh |
| SW old | Features missing | SW version | Clear SW, reload |
| Sync conflict | Duplicate entries | Server + local | Resolve conflict |
| Auth expired | Sync fails silently | Token validity | Re-authenticate |

### Phase 6: Debug Commands

```bash
# Check shared package sync modules
grep -rn "sync\|offline" packages/shared/src/hooks/ --include="*.ts"

# Find job queue implementation
grep -rn "JobQueue\|useJobQueue" packages/shared/src/

# Check service worker
cat packages/client/src/sw.ts
```

### Phase 7: Log Analysis

Enable debug mode in app:

```typescript
// In useUIStore
const { setDebugMode } = useUIStore();
setDebugMode(true);
```

With debug mode:
- Verbose sync logs in console
- Detailed error toasts
- Network request logging

### Phase 8: Generate Debug Report

```markdown
# Offline Sync Debug Report

## Environment
- Browser: [browser info]
- Online Status: [online/offline]
- Service Worker: [active/inactive]
- SW Version: [version]

## Job Queue Status
- Total Jobs: N
- Pending: X
- In Progress: Y
- Failed: Z
- Completed: W

### Stuck Jobs
| Job ID | Type | Created | Retries | Error |
|--------|------|---------|---------|-------|

## IndexedDB Status
- Database: green-goods
- Stores: [list]
- Total Records: N

### Potentially Stale Data
| Store | Key | Last Updated |
|-------|-----|--------------|

## Service Worker
- Registration: [active/waiting/none]
- Version: [version]
- Cache Keys: [list]

## Sync Events
| Time | Event | Status | Details |
|------|-------|--------|---------|

## Recommendations
1. [Action 1]
2. [Action 2]
```

## Recovery Procedures

### Clear Job Queue

```typescript
const store = useJobQueueStore.getState();
store.clearQueue();
```

### Force Refresh IndexedDB

```javascript
// Delete and recreate database
indexedDB.deleteDatabase("green-goods");
// Reload app to recreate
location.reload();
```

### Update Service Worker

```javascript
// Unregister current SW
const registration = await navigator.serviceWorker.getRegistration();
await registration?.unregister();
// Reload to get new SW
location.reload();
```

### Retry Failed Sync

```typescript
const { retryFailed } = useJobQueue();
await retryFailed();
```

## Key Principles

- **Non-destructive first** - Read-only diagnosis before any fixes
- **User data safety** - Never delete user's pending work
- **Incremental recovery** - Try least invasive fix first
- **Document state** - Capture state before making changes
