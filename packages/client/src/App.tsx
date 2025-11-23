import { queryClient } from "@green-goods/shared/config/react-query";
import { ensureBaseLists } from "@green-goods/shared/hooks";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  type PersistedClient,
  type Persister,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client";
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@/components/UI/ErrorBoundary/AppErrorBoundary";
import "@green-goods/shared/modules/app/service-worker"; // Initialize service worker
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
  // Prefetch base lists at app start for instant UX
  useEffect(() => {
    void ensureBaseLists();
  }, []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <RouterProvider router={router} />
        </AppErrorBoundary>
      </QueryClientProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
