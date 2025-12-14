import { ensureBaseLists } from "@green-goods/shared";
import { queryClient } from "@green-goods/shared/config/react-query";
import {
  type PersistedClient,
  type Persister,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@/components/Errors";
import "@green-goods/shared/modules/app/service-worker"; // Initialize service worker
import type { Query } from "@tanstack/react-query";
import { router } from "@/router";

const createSyncStoragePersister = ({ storage }: { storage: Storage }): Persister => {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        storage.setItem("__rq_pc__", JSON.stringify(client));
      } catch {}
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const raw = storage.getItem("__rq_pc__");
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch {
        return undefined;
      }
    },
    removeClient: async (): Promise<void> => {
      try {
        storage.removeItem("__rq_pc__");
      } catch {}
    },
  } as Persister;
};

function App() {
  // Prefer IndexedDB persister for larger caches; fall back to localStorage
  const createIDBPersister = ({
    dbName,
    storeName,
  }: {
    dbName: string;
    storeName: string;
  }): Persister | undefined => {
    try {
      const store = createStore(dbName, storeName);
      return {
        persistClient: async (client: PersistedClient) => {
          try {
            await idbSet("__rq_pc__", client, store);
          } catch {}
        },
        restoreClient: async (): Promise<PersistedClient | undefined> => {
          try {
            return (await idbGet("__rq_pc__", store)) as PersistedClient | undefined;
          } catch {
            return undefined;
          }
        },
        removeClient: async (): Promise<void> => {
          try {
            await idbDel("__rq_pc__", store);
          } catch {}
        },
      } as Persister;
    } catch (e) {
      console.warn("Failed to initialize IndexedDB persister, falling back to storage", e);
      return undefined;
    }
  };
  const idbPersister = createIDBPersister({ dbName: "gg-react-query", storeName: "rq" });
  const persister = idbPersister ?? createSyncStoragePersister({ storage: window.localStorage });

  /**
   * Avoid persisting volatile or in-flight queries.
   *
   * This prevents TanStack Query from dehydrating "pending" queries that later reject
   * (e.g. CancelledError during invalidation/refetch), which otherwise logs noisy warnings.
   */
  const shouldDehydrateQuery = (query: Query) => {
    // Only persist stable query results.
    if (query.state.status !== "success") return false;
    if (query.state.fetchStatus !== "idle") return false;

    const key = query.queryKey;
    // Only apply these rules to our app keys; let other libraries decide independently.
    if (!Array.isArray(key) || key[0] !== "greengoods") return true;

    // Queue stats and other queue keys are cheap + high churn; don't persist them.
    if (key[1] === "queue") return false;

    return true;
  };

  // Prefetch base lists at app start for instant UX
  useEffect(() => {
    void ensureBaseLists();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery } }}
    >
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </PersistQueryClientProvider>
  );
}

export default App;
