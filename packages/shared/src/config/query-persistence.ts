import type { Query } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { debugWarn } from "../utils";

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

interface PersistedClient {
  timestamp: number;
  buster: string;
  clientState: unknown;
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

export function createQueryPersister({
  dbName,
  storeName = "rq",
  storage = typeof window !== "undefined" ? window.localStorage : undefined,
}: CreateQueryPersisterOptions): QueryPersister {
  return createIDBPersister({ dbName, storeName }) ?? createStoragePersister(storage);
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
