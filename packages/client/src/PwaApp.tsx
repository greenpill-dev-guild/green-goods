import { isDemoPoolingActive } from "@green-goods/shared/commitment-pooling/demo-mode";
import {
  createQueryPersister,
  createShouldDehydrateQuery,
  PERSIST_MAX_AGE,
} from "@green-goods/shared/config/query-persistence";
import { queryClient } from "@green-goods/shared/config/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { createPwaRouter } from "@/router";

const persister = createQueryPersister({ dbName: "gg-react-query", storeName: "rq" });
const shouldPersistBaseQuery = createShouldDehydrateQuery({ excludedGroups: ["queue"] });
const pwaRouter = createPwaRouter();

export function PwaApp() {
  const shouldDehydrateQuery = (query: Parameters<typeof shouldPersistBaseQuery>[0]) => {
    if (!shouldPersistBaseQuery(query)) return false;
    const key = query.queryKey;
    return !(key[1] === "commitment-pooling" && isDemoPoolingActive());
  };

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
        maxAge: PERSIST_MAX_AGE,
        buster: import.meta.env.VITE_APP_VERSION || "dev",
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
