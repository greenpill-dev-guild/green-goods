import {
  type PersistedClient,
  persistQueryClientRestore,
} from "@tanstack/react-query-persist-client";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { createQueryPersister, PERSIST_MAX_AGE } from "@green-goods/shared";
import { afterEach, describe, expect, it } from "vitest";

describe("query persistence compatibility", () => {
  const persisters: ReturnType<typeof createQueryPersister>[] = [];

  afterEach(async () => {
    await Promise.all(persisters.map((persister) => persister.removeClient()));
    persisters.length = 0;
  });

  it("restores the existing persisted cache shape from IndexedDB", async () => {
    const source = new QueryClient();
    const restored = new QueryClient();
    const persister = createQueryPersister({
      dbName: `gg-query-persistence-test-${crypto.randomUUID()}`,
    });
    persisters.push(persister);

    const queryKey = ["greengoods", "gardens", 11155111] as const;
    const data = [{ id: "garden-1", name: "Community Garden" }];
    source.setQueryData(queryKey, data);

    const persistedClient: PersistedClient = {
      timestamp: Date.now(),
      buster: "wave-3",
      clientState: dehydrate(source),
    };
    await persister.persistClient(persistedClient);

    await persistQueryClientRestore({
      queryClient: restored,
      persister,
      maxAge: PERSIST_MAX_AGE,
      buster: "wave-3",
    });

    expect(restored.getQueryData(queryKey)).toEqual(data);
    expect(await persister.restoreClient()).toEqual(persistedClient);

    source.clear();
    restored.clear();
  });
});
