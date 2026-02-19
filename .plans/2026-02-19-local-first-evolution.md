# Local-First Evolution: From Offline-First PWA to True Local-First

## Context

Green Goods is already a **production-grade offline-first PWA** — custom IndexedDB job queue, event-driven sync, exponential backoff, user-scoped data isolation, storage quota monitoring, and Workbox caching. This plan evolves the architecture from "offline-first" (works without network) to "local-first" (local data is the source of truth, network is an enhancement).

### Current State Summary

| Layer | Implementation | File(s) |
|---|---|---|
| Local DB | IndexedDB via `idb` (job queue v5, drafts v1, avatar cache) | `shared/src/modules/job-queue/db.ts`, `draft-db.ts` |
| Form persistence | `sessionStorage` (lost on browser close) | `shared/src/utils/storage/form.ts` |
| Sync | Custom event bus + exponential backoff (1s→60s, max 5 retries) | `shared/src/modules/job-queue/index.ts`, `event-bus.ts` |
| Service worker | Vite PWA + Workbox: NetworkFirst (JS), CacheFirst (images), StaleWhileRevalidate (indexer 24h) | `client/vite.config.ts`, `shared/src/modules/app/service-worker.ts` |
| Query client | TanStack Query v5, `networkMode: "offlineFirst"` | `shared/src/config/react-query.ts` |
| Merged data | `useMerged` — combines online (indexer) + offline (local jobs) | `shared/src/hooks/app/useMerged.ts` |
| Tx queue | Full offline queue → passkey submission on reconnect | `shared/src/modules/work/work-submission.ts` |
| CRDT / sync engine | **None** | — |
| Local SQL database | **None** (IndexedDB only) | — |

### Key Gaps

1. **Reads fail offline after 24h** — StaleWhileRevalidate cache expires, `getGardens()`/`getActions()`/`getGardeners()` return `[]`
2. **No local SQL** — can't do JOINs, aggregations, or complex filtering client-side
3. **Form state lost on browser close** — `sessionStorage` in `form.ts:10` clears when tab closes
4. **No race pattern** — waits for network timeout (12s via `graphql-client.ts:13`) before falling back to cache
5. **No background sync for reads** — indexer data only refreshes when app is open
6. **Wallet users have no offline queue** — `wallet-submission.ts` does direct submission, no queuing

### Ecosystem Context (2026)

The local-first ecosystem has consolidated around:
- **Storage**: wa-sqlite (WASM) + OPFS as the production standard (Notion's 20% speedup at scale)
- **Sync engines**: TanStack DB + ElectricSQL (beta), Zero (late alpha), PowerSync (production)
- **React integration**: TanStack DB extends TanStack Query's API (we already use TQ v5)
- **Community**: Local-First Conf (Berlin), FOSDEM devroom, localfirst.fm podcast, weekly newsletter

Key references:
- [Syntax #867: Zero Sync](https://syntax.fm/show/867/zero-sync-is-the-future-of-data-loading/transcript) — "I have never seen a loading spinner"
- [ElectricSQL + TanStack DB](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db) — incremental adoption from TanStack Query
- [Notion WASM SQLite](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite) — 20-33% faster, zero corruption
- [PowerSync: SQLite on the Web](https://www.powersync.com/blog/sqlite-persistence-on-the-web) — VFS comparison, tuning guide

---

## Implementation Order

```
Phase 1: Local SQLite Foundation          (highest impact, lowest risk)
Phase 2: Race Pattern + Stale Indicators  (immediate UX improvement)
Phase 3: Form Persistence Upgrade         (quick win)
Phase 4: Sync Engine Integration          (core local-first upgrade)
Phase 5: Unified Storage Migration        (consolidation)
Phase 6: TanStack DB Reactive Queries     (final evolution)
```

Phases 1-3 are independent and can be parallelized. Phase 4 depends on Phase 1. Phase 5 depends on Phase 1. Phase 6 depends on Phases 4+5.

---

## Phase 1: Local SQLite Foundation

**Goal**: Add wa-sqlite as a persistent local database running in a Web Worker, mirror indexer data into it on every fetch, enabling instant offline reads with no expiration.

**Why**: This is the single highest-impact change. Currently, after 24 hours offline, `getGardens()`, `getActions()`, and `getGardeners()` all return `[]`. With local SQLite, previously-loaded data is available forever, and all reads become sub-millisecond.

**Dependencies to add**:
```
@aspect-build/aspect-bazel-lib   (not needed)
@aspect-build/rules-js           (not needed)
wa-sqlite                        # SQLite WASM core
@aspect-build/aspect-bazel-lib   (not needed — scratch that)
```

Actual dependencies:
```bash
# In packages/shared
bun add wa-sqlite
```

### Files to create

**`packages/shared/src/modules/data/local-db.ts`** — SQLite database manager

Core responsibilities:
- Initialize wa-sqlite with OPFSCoopSyncVFS (primary) and IDBBatchAtomicVFS (fallback for Safari incognito)
- Run SQLite in a dedicated Web Worker to avoid blocking the UI thread
- Schema: `gardens`, `actions`, `gardeners`, `works`, `approvals`, `meta` (sync timestamps)
- Provide typed `query()` and `execute()` methods

Schema design:
```sql
-- Core tables (mirror indexer data)
CREATE TABLE IF NOT EXISTS gardens (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  banner_image TEXT DEFAULT '',
  gardeners TEXT DEFAULT '[]',    -- JSON array of addresses
  operators TEXT DEFAULT '[]',
  evaluators TEXT DEFAULT '[]',
  owners TEXT DEFAULT '[]',
  funders TEXT DEFAULT '[]',
  communities TEXT DEFAULT '[]',
  open_joining INTEGER DEFAULT 0,
  domain_mask INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL       -- when we last wrote this row
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT DEFAULT '',
  domain TEXT DEFAULT 'SOLAR',
  start_time INTEGER,
  end_time INTEGER,
  capitals TEXT DEFAULT '[]',       -- JSON array
  media TEXT DEFAULT '[]',          -- JSON array of resolved URLs
  instructions_json TEXT DEFAULT '', -- full ActionInstructionConfig as JSON
  created_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gardeners (
  id TEXT PRIMARY KEY,
  registered_at INTEGER NOT NULL,
  account TEXT NOT NULL,
  username TEXT DEFAULT '',
  first_garden TEXT DEFAULT '',
  synced_at INTEGER NOT NULL
);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**`packages/shared/src/modules/data/local-db-worker.ts`** — Web Worker for SQLite operations

Handles:
- Initializing wa-sqlite with VFS detection (OPFS → IDB fallback)
- Processing SQL queries off the main thread
- Responding via `postMessage` with typed results

**`packages/shared/src/modules/data/local-db-sync.ts`** — Sync indexer responses into local SQLite

Core pattern — "write-through cache":
```typescript
// After every successful indexer fetch, persist to local SQLite
export async function syncGardensToLocal(gardens: Garden[]): Promise<void> {
  const now = Date.now();
  await localDB.transaction(async (tx) => {
    for (const garden of gardens) {
      await tx.execute(
        `INSERT OR REPLACE INTO gardens (...) VALUES (...)`,
        [garden.id, garden.chainId, ..., now]
      );
    }
    await tx.execute(
      `INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)`,
      ['gardens_last_sync', String(now), now]
    );
  });
}
```

### Files to modify

**`packages/shared/src/modules/data/greengoods.ts`** — Add write-through caching

After every successful indexer fetch (lines 56, 173, 244), add:
```typescript
// After line 56 (getActions successful response)
const actions = await Promise.all(data.Action.map(async ({ ... }) => { ... }));
// NEW: Persist to local SQLite
syncActionsToLocal(actions).catch(err =>
  logger.warn("[getActions] Failed to sync to local DB", { error: err })
);
return actions;
```

Same pattern for `getGardens()` and `getGardeners()`.

**`packages/shared/src/modules/data/greengoods.ts`** — Add local SQLite fallback

When indexer returns `[]` or errors, check local SQLite:
```typescript
// In getGardens(), after error case (line 223-226)
if (error || !data?.Garden?.length) {
  logger.warn("[getGardens] Indexer unavailable, trying local DB");
  const localGardens = await getGardensFromLocal();
  if (localGardens.length > 0) {
    return localGardens; // Serve from local SQLite
  }
  return []; // Truly empty
}
```

**`packages/client/vite.config.ts`** — Configure WASM + Worker support

Add to Vite config:
```typescript
// In optimizeDeps.exclude, add wa-sqlite (WASM modules should not be pre-bundled)
exclude: ["@green-goods/shared", "wa-sqlite"],

// Add worker config
worker: {
  format: "es",
},
```

Also ensure `*.wasm` files are included in the asset pipeline:
```typescript
// In build config
assetsInclude: ["**/*.wasm"],
```

### Verification

1. `bun run test` — existing tests still pass
2. Manual test: Load the client, visit gardens list, then go offline → gardens still display
3. Check DevTools → Application → Storage → OPFS for SQLite database file
4. Fallback test: Open Safari incognito → verify IDBBatchAtomicVFS is used

### Caveats

- **Safari incognito**: No OPFS support. Must detect and fall back to IDBBatchAtomicVFS
- **iOS Capacitor backgrounding**: OPFS operations may be interrupted. wa-sqlite's journal mode handles this gracefully
- **Initial load**: Don't block first paint on SQLite WASM loading. Load asynchronously and race (Phase 2)
- **WASM bundle size**: wa-sqlite is ~300KB gzipped. Load lazily, not in critical path

---

## Phase 2: Race Pattern + Stale Indicators

**Goal**: Fire local SQLite query and network request simultaneously, display whichever resolves first. Show "last updated X ago" indicator when serving stale data.

**Why**: Currently the app waits up to 12s (`GRAPHQL_TIMEOUT_MS` in `graphql-client.ts:13`) before falling back to cache on slow connections. The race pattern eliminates this entirely — local SQLite responds in <1ms.

### Files to create

**`packages/shared/src/modules/data/race.ts`** — Race utility

```typescript
/**
 * Race a local SQLite query against a network request.
 * Returns whichever resolves first. If the network wins,
 * also writes through to local SQLite in the background.
 */
export async function raceLocalAndNetwork<T>(options: {
  local: () => Promise<T | null>;
  network: () => Promise<T>;
  syncToLocal: (data: T) => Promise<void>;
  operationName: string;
}): Promise<{ data: T; source: 'local' | 'network'; staleSince?: number }> {
  // ... implementation
}
```

**`packages/shared/src/components/Progress/StaleIndicator.tsx`** — "Last updated" banner

Displays when data is served from local cache:
- Shows relative time: "Updated 5 minutes ago" / "Updated 2 hours ago"
- Subtle, non-intrusive — small text below the page header
- Auto-hides when fresh data arrives from network

### Files to modify

**`packages/shared/src/modules/data/greengoods.ts`** — Wrap fetches with race pattern

Replace direct indexer calls with race:
```typescript
export async function getGardens(): Promise<Garden[]> {
  const { data } = await raceLocalAndNetwork({
    local: () => getGardensFromLocal(),
    network: () => fetchGardensFromIndexer(),
    syncToLocal: (gardens) => syncGardensToLocal(gardens),
    operationName: 'getGardens',
  });
  return data;
}
```

**`packages/shared/src/hooks/app/useMerged.ts`** — Track data freshness

Add `lastSyncedAt` to merged query metadata so components can display stale indicators.

**`packages/shared/src/config/react-query.ts`** — Adjust stale times

With local SQLite as primary, stale times can be more aggressive:
```typescript
export const STALE_TIMES = {
  baseLists: 30_000,  // 30s (was 60s) — local is always available
  works: 10_000,      // 10s (was 15s)
  queue: 5_000,       // unchanged
  merged: 3_000,      // 3s (was 5s)
} as const;
```

### Verification

1. DevTools Network → throttle to Slow 3G → page still loads instantly from local SQLite
2. Go fully offline → all previously-visited pages load with stale indicator
3. Network console shows both local and network requests firing simultaneously
4. When network wins, local SQLite is updated in background

---

## Phase 3: Form Persistence Upgrade

**Goal**: Replace `sessionStorage`-based form persistence with IndexedDB-backed persistence that survives browser closes.

**Why**: `form.ts` uses `sessionStorage` which clears when the browser tab closes. Conservation workers on mobile frequently close/reopen the PWA — losing mid-form progress is a significant UX pain point.

### Files to modify

**`packages/shared/src/utils/storage/form.ts`** — Rewrite to use draft-db

Replace `sessionStorage` with the existing `draftDB` infrastructure:

```typescript
import { draftDB } from "../../modules/job-queue/draft-db";

// Instead of sessionStorage.setItem, use draftDB.createDraft / updateDraft
// Instead of sessionStorage.getItem, use draftDB.getDraft
// Instead of sessionStorage.removeItem, use draftDB.deleteDraft
```

The existing `draft-db.ts` already handles:
- IndexedDB persistence (`green-goods-drafts`, v1)
- User-scoped queries (`userAddress_chainId` compound index)
- Max 20 drafts per user (LRU eviction)
- Image serialization for iOS Safari
- Step tracking (`currentStep`, `firstIncompleteStep`)

**`packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts`** — Use draft system

Replace `saveFormDraft()`/`loadFormDraft()` calls with draft hooks.

**`packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts`** — Use draft system

Same pattern as garden workflow.

### Verification

1. Start filling a garden creation form → close the browser entirely → reopen → form state is preserved
2. Verify max 20 drafts limit is enforced
3. Verify drafts are scoped to userAddress (different wallets see different drafts)
4. Existing draft tests pass: `bun run test` in shared package

---

## Phase 4: Sync Engine Integration

**Goal**: Replace manual fetch-and-cache with ElectricSQL Shape-based sync, enabling real-time incremental updates from the indexer's Postgres database.

**Why**: Phase 1 gives us local reads, but the sync is still manual (fetch-all-on-load). ElectricSQL's Shape API syncs only changed rows, reducing bandwidth and keeping local data current with sub-second latency.

**Prerequisites**: Phase 1 (local SQLite must exist)

### Decision: ElectricSQL + TanStack DB

**Why ElectricSQL over alternatives**:
- We already use TanStack Query v5 → TanStack DB extends the same API
- Postgres-backed (Envio indexer uses Postgres) → direct shape sync
- Incremental adoption: convert one query at a time, no big-bang rewrite
- Open source, actively maintained, production-proven (Trigger.dev: 20k writes/sec)
- Query-driven sync: loads exactly the data each view needs

**Why not Zero**: Still in late alpha, SaaS not launched, targeting beta "late 2025 or early 2026." Monitor for GA.

**Why not CRDTs**: Green Goods' work submissions are write-once attestations. No concurrent editing, no conflict resolution needed. CRDTs would be over-engineering.

### Dependencies to add

```bash
# In packages/shared
bun add @electric-sql/client @tanstack/db @tanstack/db-collections
```

### Architecture

```
Envio Indexer (Postgres)
       │
       ▼
ElectricSQL Shape API  ──── syncs filtered rows ────► Local wa-sqlite
       │                                                    │
       ▼                                                    ▼
  TanStack DB Collections ◄──── reactive queries ────── Sub-ms reads
       │
       ▼
  React Components (zero loading spinners)
```

### Files to create

**`packages/shared/src/modules/data/sync-engine.ts`** — ElectricSQL shape configuration

```typescript
import { ShapeStream } from '@electric-sql/client';

// Define shapes for each data type
export function createGardensShape(chainId: number) {
  return new ShapeStream({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'gardens',
      where: `chain_id = ${chainId}`,
    },
  });
}
```

**`packages/shared/src/modules/data/collections.ts`** — TanStack DB collections

```typescript
import { createCollection } from '@tanstack/db-collections';

export const gardensCollection = createCollection({
  id: 'gardens',
  schema: gardenSchema,
  sync: createGardensShape(DEFAULT_CHAIN_ID),
});
```

### Files to modify

**`packages/shared/src/modules/data/greengoods.ts`** — Replace fetch functions with collection reads

Phase 4 transforms `getGardens()` from "fetch from indexer" to "read from synced collection":
```typescript
export async function getGardens(): Promise<Garden[]> {
  // TanStack DB collection is always synced and local
  return gardensCollection.findMany({ where: { chainId: DEFAULT_CHAIN_ID } });
}
```

### Infrastructure requirement

ElectricSQL requires a proxy between the client and Postgres. Options:
1. **Electric Cloud** (hosted) — simplest, managed
2. **Self-hosted Electric** — Docker container alongside the indexer
3. **Vercel Edge** — Electric supports edge deployment

The Envio indexer already runs Postgres. Electric can connect directly to it.

### Verification

1. Monitor Electric sync stream in DevTools → Network → WebSocket
2. Add a garden via admin → client receives update within ~1s (no manual refresh)
3. Go offline → gardens still display from local SQLite
4. Check sync bandwidth: should be rows-changed only, not full table dumps
5. `bun run test` — all existing tests pass

---

## Phase 5: Unified Storage Migration

**Goal**: Consolidate all local storage (job queue, drafts, avatar cache, form state) from separate IndexedDB databases into the single local SQLite database.

**Why**: Reduces complexity from 3+ IndexedDB databases to 1 SQLite database. Enables cross-entity SQL queries (e.g., "all drafts for gardens in this location"). Simplifies storage quota management.

**Prerequisites**: Phase 1 (local SQLite)

### Migration plan

| Current Store | Current Location | Target |
|---|---|---|
| Job queue (jobs, job_images, cached_work, mappings) | IndexedDB `green-goods-job-queue` v5 | SQLite `jobs`, `job_images`, `work_id_mappings` tables |
| Drafts (drafts, draft_images) | IndexedDB `green-goods-drafts` v1 | SQLite `drafts`, `draft_images` tables |
| Avatar cache | IndexedDB (custom) | SQLite `avatar_cache` table |
| Form state | `sessionStorage` | Already migrated in Phase 3 |
| Failed delete IDs | `localStorage` (`gg_failed_delete_job_ids`) | SQLite `failed_deletes` table |

### Files to modify

**`packages/shared/src/modules/job-queue/db.ts`** — Rewrite `JobQueueDatabase` class

Replace `idb` (IndexedDB wrapper) with SQLite queries via `local-db.ts`. The public API stays identical:
- `addJob()`, `getJobs()`, `updateJob()`, `markJobSynced()`, `markJobFailed()`, `deleteJob()`
- Internal storage moves from IndexedDB transactions to SQLite transactions
- Binary data (images): Store as BLOBs in SQLite or keep in OPFS with path references

**`packages/shared/src/modules/job-queue/draft-db.ts`** — Rewrite `DraftDatabase` class

Same pattern: replace `idb` with SQLite queries, keep public API identical.

### Migration strategy

1. Add SQLite tables alongside existing IndexedDB stores
2. On first load after upgrade, run one-time migration: read all data from IndexedDB → write to SQLite
3. After successful migration, mark IndexedDB as migrated (don't delete yet)
4. After 2 release cycles, remove IndexedDB code and old databases

```typescript
// Migration check on init
async function migrateIfNeeded() {
  const migrated = await localDB.get('sync_meta', 'idb_migration_complete');
  if (migrated) return;

  // Migrate jobs
  const idbJobs = await jobQueueDB_legacy.getAllJobsUnfiltered();
  for (const job of idbJobs) {
    await localDB.execute('INSERT OR IGNORE INTO jobs ...', [...]);
  }

  // Mark complete
  await localDB.execute(
    'INSERT INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
    ['idb_migration_complete', 'true', Date.now()]
  );
}
```

### Verification

1. Fresh install: only SQLite database exists, no IndexedDB databases
2. Upgrade from current version: data migrated from IndexedDB → SQLite, verified by comparing counts
3. `bun run test` — all job queue and draft tests pass with new SQLite backend
4. Storage quota check: single SQLite file instead of multiple IDB databases

---

## Phase 6: TanStack DB Reactive Queries

**Goal**: Replace TanStack Query hooks with TanStack DB Live Queries for sub-millisecond reactive updates from local SQLite.

**Why**: Currently, `useMerged` manually combines online and offline sources with `useEffect` invalidation (`useMerged.ts:66-83`). TanStack DB handles this natively — Live Queries react to local data changes in microseconds using differential dataflow.

**Prerequisites**: Phases 4 + 5

### Files to modify

**`packages/shared/src/hooks/app/useMerged.ts`** — Replace with TanStack DB Live Query

The entire `useMerged` pattern becomes unnecessary:

```typescript
// BEFORE (current): 103 lines of manual source merging
export function useMerged<TOnline, TOffline, TMerged>(options) {
  const onlineQuery = useQuery({ ... });
  const offlineQuery = useQuery({ ... });
  const mergedQuery = useQuery({ ... }); // manual merge
  useEffect(() => { /* invalidation logic */ });
  return { online: onlineQuery, offline: offlineQuery, merged: mergedQuery };
}

// AFTER (TanStack DB): ~10 lines
export function useGardens() {
  return useLiveQuery(
    gardensCollection.liveMany({ where: { chainId: DEFAULT_CHAIN_ID } })
  );
}
```

**`packages/shared/src/config/react-query.ts`** — Reduce scope

TanStack Query remains for non-synced data (user profile, EAS attestations), but synced entity queries move to TanStack DB. Simplify the QueryClient config.

**`packages/shared/src/hooks/work/useWorks.ts`** — Convert to Live Query

Works become a TanStack DB collection that merges local job queue entries with synced attestations natively.

### Hooks to migrate

| Current Hook | File | Migration |
|---|---|---|
| `useWorksMerged` | `hooks/work/useWorks.ts` | → `useLiveQuery(worksCollection.liveMany(...))` |
| `useGardensMerged` | `hooks/garden/useGardens.ts` | → `useLiveQuery(gardensCollection.liveMany(...))` |
| `useActionsMerged` | `hooks/action/useActions.ts` | → `useLiveQuery(actionsCollection.liveMany(...))` |
| `useDrafts` | `hooks/work/useDrafts.ts` | → `useLiveQuery(draftsCollection.liveMany(...))` |

### Verification

1. Zero loading spinners on any page (data always available locally)
2. React DevTools Profiler: no unnecessary re-renders from query invalidation
3. Performance benchmark: page navigation < 100ms (vs current ~200-500ms on slow connections)
4. `bun run test` — all hooks tests pass with new TanStack DB backend

---

## Future Considerations (Not in Scope)

### Wallet User Offline Queue (Enhancement)
Currently `wallet-submission.ts` requires an active wallet connection — no offline support. Could be addressed by:
1. Queue the transaction intent (calldata, target, value) in local SQLite
2. On reconnect, prompt user to sign the queued transaction
3. Challenge: nonces are sequential and depend on on-chain state. Must re-nonce on reconnect

### Periodic Background Sync for Reads
Use the [Periodic Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API) to refresh indexer data while the PWA is backgrounded. Limited browser support (Chrome only), but progressive enhancement.

### P2P Sync Between Devices
For scenarios where multiple field workers share a garden but have no internet, explore peer-to-peer sync options:
- **WebRTC Data Channels** for direct device-to-device sync
- **Automerge** for CRDT-based merge (overkill for write-once data, but useful if collaborative features are added)
- **Jazz/CoJSON** for a full distributed database (greenfield approach)

### Edge Caching of Indexer Data
Deploy ElectricSQL at the edge (Vercel Edge, Cloudflare Workers) to serve sync shapes from CDN, reducing latency for global users.

---

## Resource Links

### Core Tools
- [wa-sqlite](https://github.com/nicolomaioli/nicolomaioli.github.io) — SQLite WASM with OPFS/IDB VFS
- [ElectricSQL](https://electric-sql.com/) — Postgres sync engine
- [TanStack DB](https://tanstack.com/db) — Client-side reactive database
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) — Already in use

### Reference Implementations
- [Notion WASM SQLite Case Study](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite)
- [PowerSync SQLite Persistence Guide](https://www.powersync.com/blog/sqlite-persistence-on-the-web)
- [ElectricSQL + TanStack DB Migration Guide](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db)

### Community
- [Syntax #867: Zero Sync](https://syntax.fm/show/867/zero-sync-is-the-future-of-data-loading/transcript)
- [Scott Tolinski: Local-First Options Taxonomy](https://tolin.ski/posts/local-first-options)
- [localfirst.fm Podcast](https://www.localfirst.fm/)
- [Local-First News (Weekly)](https://www.localfirstnews.com/)
- [Local-First Conf 2026](https://www.localfirstconf.com/) — July 12-14, Berlin
- [FOSDEM 2026 Local-First Track](https://fosdem.org/2026/schedule/track/local-first/)
- [awesome-local-first](https://github.com/alantriesagain/awesome-local-first)

### Research
- [Ink & Switch: Keyhive (E2EE Access Control)](https://www.inkandswitch.com/keyhive/notebook/01/)
- [Martin Kleppmann: Eg-walker (EuroSys 2025)](https://martin.kleppmann.com/)
- [OrderlessChain: CRDT-based BFT Blockchain](https://dl.acm.org/doi/10.1145/3590140.3629111)
- [Green Smart Contracts: Local-First Contract Execution](https://dl.acm.org/doi/10.1145/3607196)
