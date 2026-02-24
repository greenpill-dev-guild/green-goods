import { debugWarn } from "@green-goods/shared";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";

/** Maximum age for persisted queries (24 hours) */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

// --- Persisters ---------------------------------------------------------------

function createIDBPersister(dbName: string, storeName: string): Persister | undefined {
  try {
    const store = createStore(dbName, storeName);
    return {
      persistClient: async (client: PersistedClient) => {
        try {
          await idbSet("__rq_pc__", client, store);
        } catch (error) {
          debugWarn("[Persister] Failed to persist client to IndexedDB:", error);
        }
      },
      restoreClient: async (): Promise<PersistedClient | undefined> => {
        try {
          return (await idbGet("__rq_pc__", store)) as PersistedClient | undefined;
        } catch (error) {
          debugWarn("[Persister] Failed to restore client from IndexedDB:", error);
          return undefined;
        }
      },
      removeClient: async (): Promise<void> => {
        try {
          await idbDel("__rq_pc__", store);
        } catch (error) {
          debugWarn("[Persister] Failed to remove client from IndexedDB:", error);
        }
      },
    } as Persister;
  } catch (e) {
    debugWarn("[Persister] Failed to initialize IndexedDB persister, falling back to localStorage:", e);
    return undefined;
  }
}

function createLocalStoragePersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        localStorage.setItem("__rq_pc__", JSON.stringify(client));
      } catch (error) {
        debugWarn("[Persister] Failed to persist client to localStorage:", error);
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const raw = localStorage.getItem("__rq_pc__");
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch (error) {
        debugWarn("[Persister] Failed to restore client from localStorage:", error);
        return undefined;
      }
    },
    removeClient: async (): Promise<void> => {
      try {
        localStorage.removeItem("__rq_pc__");
      } catch (error) {
        debugWarn("[Persister] Failed to remove client from localStorage:", error);
      }
    },
  } as Persister;
}

/** IndexedDB persister with localStorage fallback. Separate DB from client app. */
export const persister: Persister =
  createIDBPersister("gg-admin-react-query", "rq") ?? createLocalStoragePersister();

// --- Dehydration filter -------------------------------------------------------

/**
 * Only persist stable, successful queries under the "greengoods" namespace.
 * Skip volatile keys (queue, role) to avoid stale session/high-churn data.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  if (query.state.fetchStatus !== "idle") return false;

  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== "greengoods") return false;

  // High-churn or session-specific keys — don't persist
  if (key[1] === "queue" || key[1] === "role") return false;

  return true;
}
