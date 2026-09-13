import { isDemoPoolingActive } from "@green-goods/shared/commitment-pooling/demo-mode";
import {
  createQueryPersister,
  createShouldDehydrateQuery,
  isDurableWorkRead,
  restoreDurableWorkQuery,
  QUERY_CACHE_SCHEMA_VERSION,
} from "@green-goods/shared/config/query-persistence";
import { configureOfflineQueryPersistence } from "@green-goods/shared/modules/offline-content/query-writer";
import { reportOfflineStorageFailure } from "@green-goods/shared/modules/offline-content/store";
import { dehydrate } from "@tanstack/react-query";
import { queryClient } from "@green-goods/shared/config/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { createPwaRouter } from "@/router";

const persister = createQueryPersister({
  dbName: "gg-react-query",
  storeName: "rq",
  migrateLegacyBuster: true,
  preservePreparedContent: true,
  onPersistenceError: reportOfflineStorageFailure,
  shouldRestoreQuery: (query) => isDurableWorkRead(query.queryKey),
  transformRestoredQuery: restoreDurableWorkQuery,
});
const shouldPersistBaseQuery = createShouldDehydrateQuery({ excludedGroups: ["queue"] });
const shouldDehydrateQuery = (query: Parameters<typeof shouldPersistBaseQuery>[0]) => {
  if (!shouldPersistBaseQuery(query) || !isDurableWorkRead(query.queryKey)) return false;
  const key = query.queryKey;
  return !(key[1] === "commitment-pooling" && isDemoPoolingActive());
};
configureOfflineQueryPersistence(async (client) => {
  if (!persister.persistClientVerified) throw new Error("Reading cache is unavailable");
  await persister.persistClientVerified({
    timestamp: Date.now(),
    buster: QUERY_CACHE_SCHEMA_VERSION,
    clientState: dehydrate(client, { shouldDehydrateQuery }),
  });
});
const pwaRouter = createPwaRouter();

export function PwaApp() {
  const dropPersistedPoolingReads = () => {
    if (!import.meta.env.DEV || !isDemoPoolingActive()) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[1] === "commitment-pooling",
    });
  };

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: Infinity,
        buster: QUERY_CACHE_SCHEMA_VERSION,
        dehydrateOptions: { shouldDehydrateQuery },
      }}
      onSuccess={dropPersistedPoolingReads}
    >
      <AppErrorBoundary>
        <RouterProvider router={pwaRouter} />
      </AppErrorBoundary>
    </PersistQueryClientProvider>
  );
}
