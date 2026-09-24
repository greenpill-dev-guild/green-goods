import {
  type AsyncStorage,
  experimental_createQueryPersister,
  type PersistedQuery,
} from "@tanstack/query-persist-client-core";
import {
  hashKey,
  type Query,
  type QueryClient,
  type QueryKey,
  type QueryPersister,
} from "@tanstack/react-query";
import {
  createStore,
  clear as idbClear,
  del as idbDel,
  entries as idbEntries,
  get as idbGet,
  set as idbSet,
} from "idb-keyval";
import { debugWarn } from "../utils/debug";
import {
  LEGACY_SNAPSHOT_KEY,
  type LegacySnapshotSource,
  deleteDatabase,
  isLegacySnapshot,
  readLegacySnapshot,
} from "./query-persistence-legacy";
export type { LegacySnapshotSource };
import { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";

export { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";
export {
  isDurableWorkRead,
  isOfflineReadModelQuery,
  restoreDurableWorkQuery,
} from "./query-persistence-work";

/** One persisted query: its key, hash, full state and the schema it was written under. */
export type StoredQuery = PersistedQuery;
/** What a persistence policy may inspect: the key and the settled state. */
export type PersistableQuery = Pick<Query, "queryKey" | "state">;

/** The installed app's reading cache and the whole-snapshot store it replaced. */
export const CLIENT_QUERY_CACHE_DB = "gg-query-cache";
export const CLIENT_QUERY_CACHE_STORE = "queries";
export const LEGACY_CLIENT_QUERY_CACHE = { dbName: "gg-react-query", storeName: "rq" } as const;

const DEFAULT_STORE_NAME = "queries";
const DEFAULT_PREFIX = "gg";
const DEFAULT_RESTORE_TIMEOUT_MS = 1_500;
/**
 * How long one reading-cache operation may run before its storage tier counts
 * as unusable. IndexedDB can stall without ever failing: an open queued behind
 * a blocked delete, or a wedged origin, fires no success, error or blocked
 * event. Every query reads the cache before it fetches, so without a deadline
 * one stalled open holds the whole app on its loading state. Matches the job
 * queue's database open timeout.
 */
const STORE_OPERATION_TIMEOUT_MS = 3_000;
const LEGACY_BUSTER = /^(?:dev|[a-f0-9]{7,40})$/i;

export interface CreateQueryPersistenceOptions {
  /** Database holding one record per query. Must differ from any older snapshot database. */
  dbName: string;
  storeName?: string;
  /** Web storage used when IndexedDB is unavailable; tests pass their own. */
  storage?: Storage;
  buster?: string;
  maxAge?: number;
  /** Which settled queries are written at all. Defaults to the namespace filter below. */
  shouldPersistQuery?: (query: PersistableQuery) => boolean;
  /** Reads kept whatever their age: the offline read model. */
  preserveQuery?: (queryKey: readonly unknown[]) => boolean;
  shouldRestoreQuery?: (stored: StoredQuery) => boolean;
  transformRestoredQuery?: (stored: StoredQuery) => StoredQuery;
  /** Called when a write was not kept durably: every tier refused it, or only memory holds it. */
  onPersistenceError?: () => void;
  /** How long boot waits for the restore before rendering; the restore continues after. */
  restoreTimeoutMs?: number;
  /** A whole-snapshot store from an earlier build, copied once and then deleted. */
  legacy?: LegacySnapshotSource;
}

export interface QueryPersistence {
  /** Per-query persister for the QueryClient's default query options. */
  persister: QueryPersister;
  /** Restore every stored read into the client, dropping what expired or no longer applies. */
  restore(client: QueryClient): Promise<void>;
  /** Write one query now, falling through the available storage tiers as needed. */
  persistQuery(client: QueryClient, queryKey: QueryKey): Promise<void>;
  /** Remove expired and incompatible entries. Resolves with how many were removed. */
  gc(): Promise<number>;
  clear(): Promise<void>;
}

export interface CreateShouldDehydrateQueryOptions {
  namespace?: string;
  excludedGroups?: readonly string[];
}

interface QueryStore {
  /** Whether this tier survives a page restart. */
  isDurable(): boolean;
  get(key: string): Promise<StoredQuery | undefined>;
  set(key: string, value: StoredQuery): Promise<void>;
  remove(key: string): Promise<void>;
  entries(): Promise<Array<[string, StoredQuery]>>;
  clear(): Promise<void>;
}

/**
 * Resolve the browser's local storage without letting the lookup itself throw.
 * Browsers that block site storage raise a `SecurityError` on the mere property
 * read of `window.localStorage`.
 */
function resolveDefaultStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage ?? undefined;
  } catch (error) {
    debugWarn("[Persister] Browser storage is not accessible; caching in memory only:", {
      error,
    });
    return undefined;
  }
}

function createIdbQueryStore(dbName: string, storeName: string): QueryStore | undefined {
  if (typeof indexedDB === "undefined" || !indexedDB) return undefined;
  try {
    const store = createStore(dbName, storeName);
    return {
      isDurable: () => true,
      get: (key) => idbGet<StoredQuery>(key, store),
      set: (key, value) => idbSet(key, value, store),
      remove: (key) => idbDel(key, store),
      entries: async () =>
        (await idbEntries<string, StoredQuery>(store)).filter(
          ([key, value]) => typeof key === "string" && value !== undefined
        ),
      clear: () => idbClear(store),
    };
  } catch (error) {
    debugWarn("[Persister] IndexedDB is unavailable, falling back to web storage:", { error });
    return undefined;
  }
}

function createWebQueryStore(storage: Storage, prefix: string): QueryStore {
  const keyPrefix = `${prefix}-`;
  const parse = (raw: string | null): StoredQuery | undefined => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as StoredQuery;
    } catch {
      return undefined;
    }
  };
  return {
    isDurable: () => true,
    get: async (key) => parse(storage.getItem(key)),
    set: async (key, value) => {
      storage.setItem(key, JSON.stringify(value));
    },
    remove: async (key) => {
      storage.removeItem(key);
    },
    entries: async () => {
      const found: Array<[string, StoredQuery]> = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(keyPrefix)) continue;
        const value = parse(storage.getItem(key));
        if (value) found.push([key, value]);
      }
      return found;
    },
    clear: async () => {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith(keyPrefix)) storage.removeItem(key);
      }
    },
  };
}

function createMemoryQueryStore(): QueryStore {
  const memory = new Map<string, StoredQuery>();
  return {
    isDurable: () => false,
    get: async (key) => memory.get(key),
    set: async (key, value) => {
      memory.set(key, value);
    },
    remove: async (key) => {
      memory.delete(key);
    },
    entries: async () => [...memory.entries()],
    clear: async () => memory.clear(),
  };
}

/** Settle with the operation, or reject once it has run past the deadline. */
function withDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Reading cache storage did not answer within ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([operation, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Use the next storage tier when the current one refuses an operation or
 * never answers it.
 *
 * IndexedDB opens lazily, so merely constructing its store does not prove it
 * is usable. Safari private mode and storage policy failures can arrive from
 * the first asynchronous operation instead, and a stalled open may never
 * settle at all. Demoting for the rest of this session makes the documented
 * IDB -> web storage -> memory chain real.
 *
 * A tier failing is not itself a persistence error: a read that falls back, or
 * a write that web storage keeps, lost nothing. `onLostWrite` hears only about
 * writes that no durable tier kept, which is what the installed app reports as
 * offline storage being full.
 */
function createFailoverQueryStore(
  stores: QueryStore[],
  onLostWrite: (error: unknown) => void
): QueryStore {
  let active = 0;
  const run = async <T>(operation: (store: QueryStore) => Promise<T>): Promise<T> => {
    const tier = active;
    try {
      return await withDeadline(operation(stores[tier]), STORE_OPERATION_TIMEOUT_MS);
    } catch (error) {
      debugWarn("[Persister] Reading cache tier failed; using the next one", { error });
      // Boot starts many reads at once, and a stalled tier fails them together.
      // Only the first failure demotes it; the rest retry wherever it now points,
      // so a burst cannot skip a tier that still works.
      if (tier === active) {
        if (tier >= stores.length - 1) throw error;
        active = tier + 1;
      }
      return run(operation);
    }
  };
  const write = async (operation: (store: QueryStore) => Promise<void>): Promise<void> => {
    try {
      await run(operation);
    } catch (error) {
      onLostWrite(error);
      throw error;
    }
    if (!stores[active].isDurable()) {
      onLostWrite(new Error("Reading cache is keeping this write in memory only"));
    }
  };
  return {
    isDurable: () => stores[active].isDurable(),
    get: (key) => run((store) => store.get(key)),
    set: (key, value) => write((store) => store.set(key, value)),
    remove: (key) => run((store) => store.remove(key)),
    entries: () => run((store) => store.entries()),
    clear: () => run((store) => store.clear()),
  };
}

/** Web storage that throws on first touch is treated as absent, like a blocked IndexedDB. */
function usableWebStorage(storage: Storage | undefined): Storage | undefined {
  if (!storage) return undefined;
  try {
    storage.getItem(`${DEFAULT_PREFIX}-probe`);
    return storage;
  } catch (error) {
    debugWarn("[Persister] Web storage refused access; caching in memory only:", { error });
    return undefined;
  }
}

/**
 * Build an app's reading cache: one IndexedDB record per query, written when a
 * query settles and restored at boot. IndexedDB is preferred, web storage is the
 * fallback, and when neither can be reached reads stay in memory for the
 * session. Never throws.
 */
export function createQueryPersistence(options: CreateQueryPersistenceOptions): QueryPersistence {
  const {
    dbName,
    storeName = DEFAULT_STORE_NAME,
    buster = QUERY_CACHE_SCHEMA_VERSION,
    maxAge = PERSIST_MAX_AGE,
    shouldPersistQuery = createShouldDehydrateQuery(),
    preserveQuery,
    shouldRestoreQuery,
    transformRestoredQuery,
    onPersistenceError,
    restoreTimeoutMs = DEFAULT_RESTORE_TIMEOUT_MS,
    legacy,
  } = options;
  const prefix = DEFAULT_PREFIX;
  const storageKey = (queryHash: string) => `${prefix}-${queryHash}`;
  const reportError = (error: unknown) => {
    debugWarn("[Persister] Reading cache operation failed", { error });
    onPersistenceError?.();
  };

  let store: QueryStore;
  let webStorage: Storage | undefined;
  try {
    webStorage = usableWebStorage("storage" in options ? options.storage : resolveDefaultStorage());
    const stores = [
      createIdbQueryStore(dbName, storeName),
      webStorage ? createWebQueryStore(webStorage, prefix) : undefined,
      createMemoryQueryStore(),
    ].filter((candidate): candidate is QueryStore => candidate !== undefined);
    store = createFailoverQueryStore(stores, reportError);
  } catch (error) {
    debugWarn("[Persister] Query persistence is disabled for this session:", { error });
    store = createMemoryQueryStore();
  }

  const isCurrentBuster = (stored: StoredQuery) =>
    stored.buster === buster ||
    (QUERY_CACHE_SCHEMA_VERSION === "1" && LEGACY_BUSTER.test(String(stored.buster ?? "")));

  /** Whether a stored entry still belongs in the cache, judged on the raw record. */
  const classify = (stored: StoredQuery, now: number): "keep" | "drop" => {
    if (!isCurrentBuster(stored) || !Array.isArray(stored.queryKey)) return "drop";
    if (stored.state?.data === undefined) return "drop";
    if (shouldRestoreQuery && !shouldRestoreQuery(stored)) return "drop";
    if (preserveQuery?.(stored.queryKey)) return "keep";
    const updatedAt = Number(stored.state.dataUpdatedAt) || 0;
    return now - updatedAt <= maxAge ? "keep" : "drop";
  };

  const persisterCore = experimental_createQueryPersister<StoredQuery>({
    storage: {
      getItem: (key) => store.get(key),
      // The persister writes after every settled fetch without awaiting, and it
      // decides what to write before the fetch has data, so the policy runs
      // here on the settled record. A refused write must never surface as an
      // unhandled rejection; the store has already reported it.
      setItem: (key, value) => {
        if (!shouldPersistQuery(value)) return Promise.resolve();
        const prepared = transformRestoredQuery ? transformRestoredQuery(value) : value;
        const preparedKey =
          prepared.queryHash === value.queryHash ? key : storageKey(prepared.queryHash);
        return store.set(preparedKey, prepared).catch(() => undefined);
      },
      removeItem: (key) => store.remove(key),
      entries: () => store.entries(),
    } satisfies AsyncStorage<StoredQuery>,
    buster,
    // Age is judged here per query, with the offline read model exempt.
    maxAge: Number.POSITIVE_INFINITY,
    prefix,
    serialize: (persistedQuery) => persistedQuery,
    deserialize: (stored) => stored,
  });

  async function persistQuery(client: QueryClient, queryKey: QueryKey): Promise<void> {
    const query = client.getQueryCache().find({ queryKey, exact: true });
    if (!query || query.state.data === undefined || !shouldPersistQuery(query)) return;
    const stored: StoredQuery = {
      queryKey: query.queryKey,
      queryHash: query.queryHash,
      state: query.state,
      buster,
    };
    const prepared = transformRestoredQuery ? transformRestoredQuery(stored) : stored;
    await store.set(storageKey(prepared.queryHash), prepared);
  }

  async function migrateLegacySnapshot(): Promise<void> {
    const legacyRecord = await readLegacySnapshot(legacy, webStorage);
    if (!legacyRecord) return;
    const { snapshot, forget } = legacyRecord;
    let rewritten = true;
    if (isLegacySnapshot(snapshot) && isCurrentBuster({ buster: snapshot.buster } as StoredQuery)) {
      for (const query of snapshot.clientState.queries) {
        if (!Array.isArray(query.queryKey) || query.state?.data === undefined) continue;
        const state = {
          ...query.state,
          dataUpdatedAt: Number(query.state.dataUpdatedAt) || snapshot.timestamp,
        };
        const queryHash = query.queryHash || hashKey(query.queryKey);
        const key = storageKey(queryHash);
        // A migration interrupted by a closing tab leaves the snapshot in place
        // and runs again next boot. By then this query may have been refetched,
        // so the snapshot is only the newer answer where nothing newer exists.
        const existing = (await store.get(key).catch(() => undefined)) as StoredQuery | undefined;
        if (existing && Number(existing.state?.dataUpdatedAt) >= Number(state.dataUpdatedAt)) {
          continue;
        }
        await store
          .set(key, { queryKey: query.queryKey, queryHash, state, buster })
          .then(() => {
            if (!store.isDurable()) rewritten = false;
          })
          .catch(() => {
            rewritten = false;
          });
      }
    }
    // The snapshot is the only copy until every record it held has been
    // rewritten. Storage filling up partway through used to delete it anyway,
    // which for an offline reader is the read model gone with no way to
    // refetch. Keeping it means the next boot retries the whole migration.
    if (rewritten) await forget();
  }

  async function restoreAll(client: QueryClient): Promise<void> {
    await migrateLegacySnapshot();
    const now = Date.now();
    for (const [key, stored] of await store.entries()) {
      if (!key.startsWith(`${prefix}-`)) continue;
      if (classify(stored, now) === "drop") {
        await store.remove(key);
        continue;
      }
      const restored = transformRestoredQuery ? transformRestoredQuery(stored) : stored;
      if (restored.queryHash !== stored.queryHash) {
        await store.remove(key);
        await store.set(storageKey(restored.queryHash), restored).catch(() => undefined);
      }
      // A screen that already fetched this read while boot waited keeps its data.
      if (client.getQueryState(restored.queryKey)?.data !== undefined) continue;
      client.setQueryData(restored.queryKey, restored.state.data, {
        updatedAt: Number(restored.state.dataUpdatedAt) || now,
      });
    }
  }

  return {
    persister: persisterCore.persisterFn as QueryPersister,
    restore: (client) =>
      Promise.race([
        restoreAll(client).catch(reportError),
        new Promise<void>((resolve) => setTimeout(resolve, restoreTimeoutMs)),
      ]),
    persistQuery,
    gc: async () => {
      const now = Date.now();
      let removed = 0;
      for (const [key, stored] of await store.entries()) {
        if (!key.startsWith(`${prefix}-`) || classify(stored, now) === "keep") continue;
        await store.remove(key);
        removed += 1;
      }
      return removed;
    },
    clear: () => store.clear(),
  };
}

function hasFallbackInstructions(data: unknown): boolean {
  return (
    Array.isArray(data) &&
    data.some((action) =>
      Boolean((action as { instructionsFallback?: boolean })?.instructionsFallback)
    )
  );
}

/** Which queries an app writes to its reading cache. */
export function createShouldDehydrateQuery({
  namespace = "greengoods",
  excludedGroups = [],
}: CreateShouldDehydrateQueryOptions = {}) {
  return (query: PersistableQuery): boolean => {
    // A failed or paused refetch still carries the last successful read.
    if (query.state.data === undefined) return false;

    const key = query.queryKey;
    if (!Array.isArray(key) || key[0] !== namespace) return false;

    // Pagination ownership is ephemeral UI state, not part of the reading cache.
    if (key[1] === "works" && key[2] === "window") return false;

    // A list whose instructions fell back to the built-in copy stays usable for
    // this session but must not become the durable offline copy.
    if (key[1] === "actions" && hasFallbackInstructions(query.state.data)) return false;

    return !excludedGroups.includes(String(key[1] ?? ""));
  };
}

/**
 * Forget an app's persisted reads, including any snapshot an older build left
 * behind. Best effort and never throws.
 */
export async function clearPersistedQueryClient(
  options: Pick<CreateQueryPersistenceOptions, "dbName" | "legacy">
): Promise<void> {
  await deleteDatabase(options.dbName);
  if (options.legacy) await deleteDatabase(options.legacy.dbName);
  try {
    const storage = resolveDefaultStorage();
    if (!storage) return;
    storage.removeItem(LEGACY_SNAPSHOT_KEY);
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(`${DEFAULT_PREFIX}-`)) storage.removeItem(key);
    }
  } catch (error) {
    debugWarn("[Persister] Failed to clear the storage cache:", { error });
  }
}
