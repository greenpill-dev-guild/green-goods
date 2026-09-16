import type { QueryClient, QueryKey } from "@tanstack/react-query";

let writer: ((client: QueryClient, queryKey: QueryKey) => Promise<void>) | undefined;

/** The app installs its reading-cache writer once; preparation persists through it. */
export function configureOfflineQueryPersistence(
  value: (client: QueryClient, queryKey: QueryKey) => Promise<void>
): void {
  writer = value;
}

/** Write one filled read now; rejects when the reading cache refuses. */
export async function persistPreparedQuery(client: QueryClient, queryKey: QueryKey): Promise<void> {
  if (!writer) throw new Error("Reading cache not ready");
  await writer(client, queryKey);
}
