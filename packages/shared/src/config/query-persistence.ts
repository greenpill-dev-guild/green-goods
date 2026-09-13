import type { DehydratedState, Query } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { debugWarn } from "../utils/debug";
import { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";

export { PERSIST_MAX_AGE, QUERY_CACHE_SCHEMA_VERSION } from "./query-cache-policy";
export { isDurableWorkRead, restoreDurableWorkQuery } from "./query-persistence-work";

const QUERY_PERSISTENCE_KEY = "__rq_pc__";

export interface CreateQueryPersisterOptions {
  dbName: string;
  storeName?: string;
  storage?: Storage;
  /** Client-only transition from deploy-keyed snapshots to schema version 1. */
  migrateLegacyBuster?: boolean;
  /** Installed client only: verified prepared reads have no age expiry. */
  preservePreparedContent?: boolean;
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
  /** Strict write acknowledgement for download coverage, never inferred from memory. */
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
    let writing = Promise.resolve();
    const write = (client: PersistedClient) => {
      const operation = writing.then(() => idbSet(QUERY_PERSISTENCE_KEY, client, store));
      writing = operation.catch(() => {});
      return operation;
    };
    return {
      persistClientVerified: async (client: PersistedClient) => {
        await write(client);
      },
      persistClient: async (client: PersistedClient) => {
        try {
          await write(client);
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
    return {
      ...persister,
      persistClient: async (client) => {
        try {
          await persister.persistClientVerified!(client);
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
        if (
          client &&
          options.preservePreparedContent &&
          Date.now() - client.timestamp > PERSIST_MAX_AGE
        ) {
          client = {
            ...client,
            clientState: {
              ...client.clientState,
              queries: client.clientState.queries.filter(
                (query) => query.meta?.offlinePrepared === true
              ),
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
          await persister.persistClient(migrated);
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
