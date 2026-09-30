import { QueryClient } from "@tanstack/react-query";
import {
  createQueryPersistence,
  type QueryPersistence,
} from "@green-goods/shared/config/query-persistence";
import { createStore, set as idbSet } from "idb-keyval";
import { afterEach, describe, expect, it } from "vitest";

describe("query persistence compatibility", () => {
  const stores: QueryPersistence[] = [];

  afterEach(async () => {
    await Promise.all(stores.map((persistence) => persistence.clear()));
    stores.length = 0;
  });

  it("restores one record per query from IndexedDB across instances", async () => {
    const dbName = `gg-query-persistence-test-${crypto.randomUUID()}`;
    const writer = createQueryPersistence({ dbName });
    stores.push(writer);
    const queryKey = ["greengoods", "gardens", 11155111] as const;
    const data = [{ id: "garden-1", name: "Community Garden" }];
    const source = new QueryClient();
    source.setQueryData(queryKey, data);
    await writer.persistQuery(source, queryKey);

    const reader = createQueryPersistence({ dbName });
    const restored = new QueryClient();
    await reader.restore(restored);

    expect(restored.getQueryData(queryKey)).toEqual(data);
    source.clear();
    restored.clear();
  });

  it("copies the whole-snapshot cache an earlier build wrote, then deletes it", async () => {
    const suffix = crypto.randomUUID();
    const legacy = { dbName: `gg-react-query-${suffix}`, storeName: "rq" };
    const queryKey = ["greengoods", "gardens", 11155111] as const;
    await idbSet(
      "__rq_pc__",
      {
        timestamp: Date.now(),
        buster: "9465f61b9795",
        clientState: {
          mutations: [],
          queries: [
            {
              queryKey,
              queryHash: JSON.stringify(queryKey),
              state: { data: [{ id: "garden-1" }], dataUpdatedAt: Date.now(), status: "success" },
            },
          ],
        },
      },
      createStore(legacy.dbName, legacy.storeName)
    );
    const persistence = createQueryPersistence({ dbName: `gg-query-cache-${suffix}`, legacy });
    stores.push(persistence);

    const restored = new QueryClient();
    await persistence.restore(restored);
    expect(restored.getQueryData(queryKey)).toEqual([{ id: "garden-1" }]);

    const again = new QueryClient();
    await createQueryPersistence({ dbName: `gg-query-cache-${suffix}` }).restore(again);
    expect(again.getQueryData(queryKey)).toEqual([{ id: "garden-1" }]);
    restored.clear();
    again.clear();
  });
});
