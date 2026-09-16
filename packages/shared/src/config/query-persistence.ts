import {
  type AsyncStorage,
  experimental_createQueryPersister,
  type PersistedQuery,
} from "@tanstack/query-persist-client-core";
import {
  type DehydratedState,
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

const LEGACY_SNAPSHOT_KEY = "__rq_pc__";
const DEFAULT_STORE_NAME = "queries";
const DEFAULT_PREFIX = "gg";
const DEFAULT_RESTORE_TIMEOUT_MS = 1_500;
const LEGACY_BUSTER = /^(?:dev|[a-f0-9]{7,40})$/i;

export interface LegacySnapshotSource {
  dbName: string;
  storeName: string;
}

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
  /** Write one query now; rejects when storage refuses so callers can report it. */
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

/** A store that swallows its own failures so a blocked browser never breaks reads. */
function guardQueryStore(store: QueryStore, onError: (error: unknown) => void): QueryStore {
  return {
    get: (key) =>
      store.get(key).catch((error) => {
        onError(error);
        return undefined;
      }),
    set: (key, value) => store.set(key, value),
    remove: (key) => store.remove(key).catch(onError),
    entries: () =>
      store.entries().catch((error) => {
        onError(error);
        return [];
      }),
    clear: () => store.clear().catch(onError),
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

function isLegacySnapshot(value: unknown): value is {
  timestamp: number;
  buster: string;
  clientState: DehydratedState;
} {
  const candidate = value as { timestamp?: unknown; buster?: unknown; clientState?: unknown };
  return (
    typeof candidate?.timestamp === "number" &&
    typeof candidate.buster === "string" &&
    Array.isArray((candidate.clientState as DehydratedState | undefined)?.queries)
  );
}

async function readLegacySnapshot(
  legacy: LegacySnapshotSource | undefined,
  storage: Storage | undefined
): Promise<{ snapshot: unknown; forget: () => Promise<void> } | undefined> {
  if (legacy && typeof indexedDB !== "undefined" && indexedDB) {
    try {
      const store = createStore(legacy.dbName, legacy.storeName);
      const snapshot = await idbGet(LEGACY_SNAPSHOT_KEY, store);
      if (snapshot !== undefined) {
        return {
          snapshot,
          forget: async () => {
            await idbDel(LEGACY_SNAPSHOT_KEY, store).catch(() => undefined);
            await deleteDatabase(legacy.dbName);
          },
        };
      }
    } catch (error) {
      debugWarn("[Persister] Could not read the previous reading cache:", { error });
    }
  }
  if (storage) {
    try {
      const raw = storage.getItem(LEGACY_SNAPSHOT_KEY);
      if (raw) {
        return {
          snapshot: JSON.parse(raw),
          forget: async () => {
            storage.removeItem(LEGACY_SNAPSHOT_KEY);
          },
        };
      }
    } catch (error) {
      debugWarn("[Persister] Could not read the previous storage cache:", { error });
    }
  }
  return undefined;
}

function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve();
  return new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
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
  };

  let store: QueryStore;
  let webStorage: Storage | undefined;
  try {
    webStorage = usableWebStorage("storage" in options ? options.storage : resolveDefaultStorage());
    store = guardQueryStore(
      createIdbQueryStore(dbName, storeName) ??
        (webStorage ? createWebQueryStore(webStorage, prefix) : createMemoryQueryStore()),
      reportError
    );
  } catch (error) {
    debugWarn("[Persister] Query persistence is disabled for this session:", { error });
    store = createMemoryQueryStore();
  }

  const isCurrentBuster = (stored: StoredQuery) =>
    stored.buster === buster ||
    (QUERY_CACHE_SCHEMA_VERSION === "1" && LEGACY_BUSTER.test(String(stored.buster ?? "")));

  /** Whether a stored entry still belongs in the cache, after the restore transform. */
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
      // unhandled rejection.
      setItem: (key, value) => {
        if (!shouldPersistQuery(value)) return Promise.resolve();
        return store.set(key, value).catch((error) => {
          reportError(error);
          onPersistenceError?.();
        });
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
    await store.set(storageKey(query.queryHash), {
      queryKey: query.queryKey,
      queryHash: query.queryHash,
      state: query.state,
      buster,
    });
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
        await store
          .set(storageKey(queryHash), { queryKey: query.queryKey, queryHash, state, buster })
          .catch((error: unknown) => {
            rewritten = false;
            reportError(error);
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
        await store.set(storageKey(restored.queryHash), restored).catch(reportError);
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
