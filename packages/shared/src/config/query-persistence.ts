import type { DehydratedState, Query } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { debugWarn } from "../utils/debug";

export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

const QUERY_PERSISTENCE_KEY = "__rq_pc__";

export interface CreateQueryPersisterOptions {
  dbName: string;
  storeName?: string;
  storage?: Storage;
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
    return createIDBPersister({ dbName, storeName }) ?? createStoragePersister(storage);
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
    if (query.state.status !== "success") return false;
    if (query.state.fetchStatus !== "idle") return false;

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
