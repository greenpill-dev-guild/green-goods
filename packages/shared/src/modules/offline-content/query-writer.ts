import type { QueryClient } from "@tanstack/react-query";

let writer: ((client: QueryClient) => Promise<void>) | undefined;
export function configureOfflineQueryPersistence(
  value: (client: QueryClient) => Promise<void>
): void {
  writer = value;
}
export async function persistPreparedQueries(client: QueryClient): Promise<void> {
  if (!writer) throw new Error("Reading cache not ready");
  await writer(client);
}
