import type { QueryClient } from "@tanstack/react-query";
import type { GardenMemberRow } from "../../modules/garden/members-batch";

const queues = new WeakMap<QueryClient, Map<string, Promise<void>>>();

/** Keep a role's snapshot, write and cache settlement together across screens and batches. */
export function runGardenRoleWrites<T>(
  client: QueryClient,
  chainId: number,
  gardenId: string,
  rows: readonly GardenMemberRow[],
  operation: () => Promise<T>
): Promise<T> {
  const queue = queues.get(client) ?? new Map<string, Promise<void>>();
  queues.set(client, queue);
  const keys = [
    ...new Set(
      rows.map(
        ({ address, role }) =>
          `${chainId}:${gardenId.toLowerCase()}:${role}:${address.toLowerCase()}`
      )
    ),
  ];
  // Reserve all rows before awaiting anything, so overlapping batches cannot deadlock.
  const result = Promise.all(keys.map((key) => queue.get(key))).then(operation);
  const settled = result.then(
    () => {},
    () => {}
  );
  for (const key of keys) queue.set(key, settled);
  void settled.then(() => {
    for (const key of keys) {
      if (queue.get(key) === settled) queue.delete(key);
    }
    if (queue.size === 0) queues.delete(client);
  });
  return result;
}
