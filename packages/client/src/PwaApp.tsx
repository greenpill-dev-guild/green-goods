import { isDemoPoolingActive } from "@green-goods/shared/commitment-pooling/demo-mode";
import {
  CLIENT_QUERY_CACHE_DB,
  CLIENT_QUERY_CACHE_STORE,
  createQueryPersistence,
  createShouldDehydrateQuery,
  isDurableWorkRead,
  isOfflineReadModelQuery,
  LEGACY_CLIENT_QUERY_CACHE,
  restoreDurableWorkQuery,
} from "@green-goods/shared/config/query-persistence";
import { configureOfflineQueryPersistence } from "@green-goods/shared/modules/offline-content/query-writer";
import { reportOfflineStorageFailure } from "@green-goods/shared/modules/offline-content/store";
import { queryClient } from "@green-goods/shared/config/react-query";
import {
  attachQueryPersistence,
  QueryPersistenceProvider,
} from "@green-goods/shared/providers/QueryPersistence";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { createPwaRouter } from "@/router";

const shouldPersistBaseQuery = createShouldDehydrateQuery({ excludedGroups: ["queue"] });
const shouldPersistQuery = (query: Parameters<typeof shouldPersistBaseQuery>[0]) => {
  if (!shouldPersistBaseQuery(query) || !isDurableWorkRead(query.queryKey)) return false;
  const key = query.queryKey;
  return !(key[1] === "commitment-pooling" && isDemoPoolingActive());
};
// One record per query. The whole-snapshot store older builds wrote is copied
// in once and then deleted.
const persistence = createQueryPersistence({
  dbName: CLIENT_QUERY_CACHE_DB,
  storeName: CLIENT_QUERY_CACHE_STORE,
  legacy: LEGACY_CLIENT_QUERY_CACHE,
  shouldPersistQuery,
  preserveQuery: (queryKey) => isOfflineReadModelQuery(queryKey),
  shouldRestoreQuery: (query) => isDurableWorkRead(query.queryKey),
  transformRestoredQuery: restoreDurableWorkQuery,
  onPersistenceError: reportOfflineStorageFailure,
});
attachQueryPersistence(queryClient, persistence);
configureOfflineQueryPersistence((client, queryKey) => persistence.persistQuery(client, queryKey));
const pwaRouter = createPwaRouter();

export function PwaApp() {
  const dropPersistedPoolingReads = () => {
    if (!import.meta.env.DEV || !isDemoPoolingActive()) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[1] === "commitment-pooling",
    });
  };

  return (
    <QueryPersistenceProvider
      client={queryClient}
      persistence={persistence}
      onRestored={dropPersistedPoolingReads}
    >
      <AppErrorBoundary>
        <RouterProvider router={pwaRouter} />
      </AppErrorBoundary>
    </QueryPersistenceProvider>
  );
}
