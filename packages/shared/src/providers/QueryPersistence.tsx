import { IsRestoringProvider, type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { QueryPersistence } from "../config/query-persistence";
import { useAsyncEffect } from "../hooks/utils/useAsyncEffect";

/** Route every query's fetch through the reading cache. Call once, before rendering. */
const manualPersistenceSubscriptions = new WeakMap<QueryClient, () => void>();

export function attachQueryPersistence(client: QueryClient, persistence: QueryPersistence): void {
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, persister: persistence.persister },
  });
  manualPersistenceSubscriptions.get(client)?.();
  manualPersistenceSubscriptions.set(
    client,
    client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success" || !event.action.manual)
        return;
      void persistence.persistQuery(client, event.query.queryKey).catch(() => undefined);
    })
  );
}

interface QueryPersistenceProviderProps {
  client: QueryClient;
  persistence: QueryPersistence;
  onRestored?: () => void;
  children: ReactNode;
}

/**
 * Restores the reading cache before observers fetch, the way the snapshot
 * provider did, but from one record per query. Rendering never waits: while
 * the restore runs, queries report `isRestoring` and hold their fetches.
 */
export function QueryPersistenceProvider({
  client,
  persistence,
  onRestored,
  children,
}: QueryPersistenceProviderProps) {
  const [isRestoring, setIsRestoring] = useState(true);

  useAsyncEffect(
    async ({ isMounted }) => {
      setIsRestoring(true);
      await persistence.restore(client).catch(() => undefined);
      if (!isMounted()) return;
      setIsRestoring(false);
      onRestored?.();
    },
    // `onRestored` is a callback identity; a new one must not restart the restore.
    [client, persistence]
  );

  return (
    <QueryClientProvider client={client}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  );
}
