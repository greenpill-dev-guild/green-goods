import { queryClient } from "@green-goods/shared/config/react-query";
import { debugWarn } from "@green-goods/shared/utils/debug";
import {
  type PersistedClient,
  type Persister,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@/components/Errors";
// Note: Service worker is registered by vite-plugin-pwa (registerType: "autoUpdate")
// Auto-update logic (foreground checks + controllerchange reload) is in main.tsx
import type { Query } from "@tanstack/react-query";
import { router } from "@/router";

const createSyncStoragePersister = ({ storage }: { storage: Storage }): Persister => {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        storage.setItem("__rq_pc__", JSON.stringify(client));
      } catch (error) {
        debugWarn("[Persister] Failed to persist client to storage:", error);
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const raw = storage.getItem("__rq_pc__");
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch (error) {
        debugWarn("[Persister] Failed to restore client from storage:", error);
        return undefined;
      }
    },
    removeClient: async (): Promise<void> => {
      try {
        storage.removeItem("__rq_pc__");
      } catch (error) {
        debugWarn("[Persister] Failed to remove client from storage:", error);
      }
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
      debugWarn(
        "[Persister] Failed to initialize IndexedDB persister, falling back to storage:",
        e
      );
      return undefined;
    }
  };
  const idbPersister = createIDBPersister({ dbName: "gg-react-query", storeName: "rq" });
  const persister = idbPersister ?? createSyncStoragePersister({ storage: window.localStorage });

  /**
   * Avoid persisting volatile or in-flight queries.
   * Only persist stable, successful query results.
   */
  const shouldDehydrateQuery = (query: Query) => {
    if (query.state.status !== "success") return false;
    if (query.state.fetchStatus !== "idle") return false;

    const key = query.queryKey;
    if (!Array.isArray(key) || key[0] !== "greengoods") return true;

    // Queue keys are high churn; don't persist
    if (key[1] === "queue") return false;

    return true;
  };

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        dehydrateOptions: { shouldDehydrateQuery },
      }}
    >
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </PersistQueryClientProvider>
  );
}

export default App;
