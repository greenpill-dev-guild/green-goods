import type { DehydratedState, Query } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { debugWarn } from "../utils/debug";
import { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";

export { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";
export {
  isDurableWorkRead,
  isOfflineReadModelQuery,
  restoreDurableWorkQuery,
} from "./query-persistence-work";

const QUERY_PERSISTENCE_KEY = "__rq_pc__";

export interface CreateQueryPersisterOptions {
  dbName: string;
  storeName?: string;
  storage?: Storage;
  /** Client-only transition from deploy-keyed snapshots to schema version 1. */
  migrateLegacyBuster?: boolean;
  /** Installed client only: reads a restored snapshot keeps whatever its age. */
  preserveQuery?: (query: DehydratedState["queries"][number]) => boolean;
  /** Ordinary writes wait at least this long after the previous one. Defaults to 1 second. */
  writeIntervalMs?: number;
  onPersistenceError?: () => void;
  shouldRestoreQuery?: (query: DehydratedState["queries"][number]) => boolean;
  transformRestoredQuery?: (
    query: DehydratedState["queries"][number]
  ) => DehydratedState["queries"][number];
}

export interface CreateShouldDehydrateQueryOptions {
  namespace?: string;
  excludedGroups?: readonly string[];
}

type MaybePromise<T> = T | Promise<T>;

export interface PersistedClient {
  timestamp: number;
  buster: string;
  clientState: DehydratedState;
}

export interface QueryPersister {
  persistClient: (client: PersistedClient) => MaybePromise<void>;
  /** Writes now, without waiting for the interval, and rejects when the write fails. */
  persistClientVerified?: (client: PersistedClient) => Promise<void>;
  restoreClient: () => MaybePromise<PersistedClient | undefined>;
  removeClient: () => MaybePromise<void>;
}

function createIDBPersister({
  dbName,
  storeName,
}: Required<Pick<CreateQueryPersisterOptions, "dbName" | "storeName">>):
  | QueryPersister
  | undefined {
  // idb-keyval opens the database lazily on first use, so a missing
  // IndexedDB would otherwise be discovered only when persisting; probe it
  // here so the storage fallback actually takes over.
  if (typeof indexedDB === "undefined" || !indexedDB) return undefined;
  try {
    const store = createStore(dbName, storeName);
    return {
      persistClientVerified: async (client: PersistedClient) => {
        await idbSet(QUERY_PERSISTENCE_KEY, client, store);
      },
      persistClient: async (client: PersistedClient) => {
        try {
          await idbSet(QUERY_PERSISTENCE_KEY, client, store);
        } catch (error) {
          debugWarn("[Persister] Failed to persist client to IndexedDB:", { error });
        }
      },
      restoreClient: async (): Promise<PersistedClient | undefined> => {
        // Fail fast if the IDB read hangs (e.g. blocked transaction from a
        // concurrent connection). Without a timeout, PersistQueryClientProvider
        // stays in `isRestoring=true` forever and pauses every query observer,
        // leaving every useQuery stuck in `pending` with the page rendering
        // empty-state placeholders.
        try {
          return (await Promise.race([
            idbGet(QUERY_PERSISTENCE_KEY, store),
            new Promise<undefined>((_, reject) =>
              setTimeout(() => reject(new Error("idb-restore-timeout")), 1500)
            ),
          ])) as PersistedClient | undefined;
        } catch (error) {
          debugWarn("[Persister] Failed to restore client from IndexedDB:", { error });
          return undefined;
        }
      },
      removeClient: async (): Promise<void> => {
        try {
          await idbDel(QUERY_PERSISTENCE_KEY, store);
        } catch (error) {
          debugWarn("[Persister] Failed to remove client from IndexedDB:", { error });
        }
      },
    } satisfies QueryPersister;
  } catch (error) {
    debugWarn("[Persister] Failed to initialize IndexedDB persister, falling back to storage:", {
      error,
    });
    return undefined;
  }
}

function createStoragePersister(storage?: Storage): QueryPersister {
  return {
    persistClientVerified: async (client: PersistedClient) => {
      if (!storage) throw new Error("Reading cache is unavailable");
      storage.setItem(QUERY_PERSISTENCE_KEY, JSON.stringify(client));
    },
    persistClient: async (client: PersistedClient) => {
      if (!storage) return;
      try {
        storage.setItem(QUERY_PERSISTENCE_KEY, JSON.stringify(client));
      } catch (error) {
        debugWarn("[Persister] Failed to persist client to storage:", { error });
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      if (!storage) return undefined;
      try {
        const raw = storage.getItem(QUERY_PERSISTENCE_KEY);
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch (error) {
        debugWarn("[Persister] Failed to restore client from storage:", { error });
        return undefined;
      }
    },
    removeClient: async (): Promise<void> => {
      if (!storage) return;
      try {
        storage.removeItem(QUERY_PERSISTENCE_KEY);
      } catch (error) {
        debugWarn("[Persister] Failed to remove client from storage:", { error });
      }
    },
  } satisfies QueryPersister;
}

/**
 * Resolve the browser's local storage without letting the lookup itself
 * throw. Browsers that block site storage (strict cookie shields, storage
 * partitioning, some private modes) raise a `SecurityError` on the mere
 * property read of `window.localStorage`; that read used to sit in a
 * destructuring default, so the throw escaped every guard below and took the
 * whole entry module down before React mounted.
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

interface PendingWrite {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Every query cache event hands the persister a full snapshot. Writing each one
 * copied the whole cache into storage on the main thread many times a second, so
 * only the newest snapshot is written: at most one write at a time, ordinary
 * writes spaced by `intervalMs`, and a pending write flushed when the page hides.
 */
function createCoalescingWriter(
  write: (client: PersistedClient) => Promise<void>,
  intervalMs: number
) {
  let latest: PersistedClient | undefined;
  let waiting: PendingWrite[] = [];
  let urgent = false;
  let running = false;
  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onHide = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
  };
  const watchHide = (active: boolean) => {
    if (typeof document === "undefined") return;
    if (active) document.addEventListener("visibilitychange", onHide);
    else document.removeEventListener("visibilitychange", onHide);
  };

  async function drain() {
    if (running || !latest) return;
    const wait = urgent ? 0 : lastWriteAt + intervalMs - Date.now();
    if (wait > 0) {
      clearTimeout(timer);
      timer = setTimeout(() => void drain(), wait);
      return;
    }
    clearTimeout(timer);
    running = true;
    const client = latest;
    const settled = waiting;
    latest = undefined;
    waiting = [];
    urgent = false;
    try {
      await write(client);
      settled.forEach((pending) => pending.resolve());
    } catch (error) {
      settled.forEach((pending) => pending.reject(error));
    } finally {
      lastWriteAt = Date.now();
      running = false;
      if (latest) void drain();
      else watchHide(false);
    }
  }

  function flush() {
    if (!latest) return;
    urgent = true;
    void drain();
  }

  return (client: PersistedClient, immediate: boolean) =>
    new Promise<void>((resolve, reject) => {
      latest = client;
      waiting.push({ resolve, reject });
      if (immediate) urgent = true;
      watchHide(true);
      void drain();
    });
}

/**
 * Build the query persister for an app. Never throws: IndexedDB is preferred,
 * web storage is the fallback, and when neither can be reached the persister
 * quietly does nothing so the app still renders with an in-memory cache.
 */
export function createQueryPersister(options: CreateQueryPersisterOptions): QueryPersister {
  const { dbName, storeName = "rq" } = options;
  try {
    const storage = "storage" in options ? options.storage : resolveDefaultStorage();
    const persister = createIDBPersister({ dbName, storeName }) ?? createStoragePersister(storage);
    const writeLatest = createCoalescingWriter(
      (client) => persister.persistClientVerified!(client),
      options.writeIntervalMs ?? 1_000
    );
    return {
      ...persister,
      persistClientVerified: (client) => writeLatest(client, true),
      persistClient: async (client) => {
        try {
          await writeLatest(client, false);
        } catch (error) {
          options.onPersistenceError?.();
          debugWarn("[Persister] Reading cache write failed", { error });
        }
      },
      restoreClient: async () => {
        let client = await persister.restoreClient();
        if (client && options.shouldRestoreQuery) {
          client = {
            ...client,
            clientState: {
              ...client.clientState,
              queries: client.clientState.queries.filter(options.shouldRestoreQuery),
            },
          };
        }
        if (client && options.transformRestoredQuery) {
          client = {
            ...client,
            clientState: {
              ...client.clientState,
              queries: client.clientState.queries.map(options.transformRestoredQuery),
            },
          };
        }
        if (client && options.preserveQuery) {
          const now = Date.now();
          const snapshotTimestamp = client.timestamp;
          client = {
            ...client,
            clientState: {
              ...client.clientState,
              queries: client.clientState.queries.filter((query) => {
                if (options.preserveQuery?.(query)) return true;
                const updatedAt = Number(query.state.dataUpdatedAt) || snapshotTimestamp;
                return now - updatedAt <= PERSIST_MAX_AGE;
              }),
              mutations: [],
            },
          };
        }
        // No read shapes changed in schema 1. Recognize the old commit/dev
        // busters only; future schema versions must still invalidate normally.
        if (
          options.migrateLegacyBuster &&
          QUERY_CACHE_SCHEMA_VERSION === "1" &&
          client &&
          /^(?:dev|[a-f0-9]{7,40})$/i.test(client.buster) &&
          Array.isArray(client.clientState?.queries) &&
          Array.isArray(client.clientState?.mutations)
        ) {
          const migrated = { ...client, buster: QUERY_CACHE_SCHEMA_VERSION };
          // Keep the original timestamp so migration never revives expired data.
          void Promise.resolve(persister.persistClient(migrated)).catch((error) => {
            debugWarn("[Persister] Failed to persist the migrated cache buster:", { error });
          });
          return migrated;
        }
        return client;
      },
    };
  } catch (error) {
    debugWarn("[Persister] Query persistence is disabled for this session:", { error });
    return createStoragePersister(undefined);
  }
}

export function createShouldDehydrateQuery({
  namespace = "greengoods",
  excludedGroups = [],
}: CreateShouldDehydrateQueryOptions = {}) {
  return (query: Query): boolean => {
    // A failed or paused refetch still carries the last successful read.
    if (query.state.data === undefined) return false;

    const key = query.queryKey;
    if (!Array.isArray(key) || key[0] !== namespace) return false;

    if (
      key[1] === "actions" &&
      Boolean(
        (query.state.data as Record<PropertyKey, unknown> | undefined)?.[
          Symbol.for("green-goods.transient-action-instructions")
        ]
      )
    )
      return false;

    return !excludedGroups.includes(String(key[1] ?? ""));
  };
}

/**
 * Forget an app's persisted query cache. A boot-recovery surface calls this
 * before reloading, so a corrupt or stale snapshot can never wedge the next
 * start. Best effort and never throws: an unavailable store is simply skipped.
 */
export async function clearPersistedQueryClient(
  options: Pick<CreateQueryPersisterOptions, "dbName">
): Promise<void> {
  try {
    if (typeof indexedDB !== "undefined" && indexedDB) {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(options.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    }
  } catch (error) {
    debugWarn("[Persister] Failed to delete the IndexedDB cache:", { error });
  }
  try {
    resolveDefaultStorage()?.removeItem(QUERY_PERSISTENCE_KEY);
  } catch (error) {
    debugWarn("[Persister] Failed to clear the storage cache:", { error });
  }
}
