/** @vitest-environment jsdom */
import {
  dehydrate,
  hydrate,
  onlineManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQueryPersistence,
  createShouldDehydrateQuery,
  isDurableWorkRead,
  isOfflineReadModelQuery,
  PERSIST_MAX_AGE,
  QUERY_CACHE_SCHEMA_VERSION,
  restoreDurableWorkQuery,
} from "../../config/query-persistence";
import { GC_TIMES, queryClient } from "../../config/react-query";
import { actionsKeys, gardensKeys } from "../../config/query-keys/garden";
import { worksKeys } from "../../config/query-keys/work";

const shouldDehydrateQuery = createShouldDehydrateQuery({ excludedGroups: ["queue"] });
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  queryClient.clear();
});

describe("durable offline reads", () => {
  it.each([
    ["gardens", gardensKeys.byChain(11155111)],
    ["actions", actionsKeys.byChain(11155111)],
    ["work", worksKeys.online("garden", 11155111)],
  ])("restores %s after a failed or paused refetch", async (_name, key) => {
    const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    source.setQueryData(key, [{ id: "last-known" }]);
    await expect(
      source.fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error("offline");
        },
      })
    ).rejects.toThrow("offline");
    for (const fetchStatus of ["idle", "paused", "fetching"] as const) {
      source.getQueryCache().find({ queryKey: key })!.setState({ fetchStatus });
      const snapshot = dehydrate(source, { shouldDehydrateQuery });
      const restored = new QueryClient();
      hydrate(restored, snapshot);
      expect(restored.getQueryData(key)).toEqual([{ id: "last-known" }]);
      restored.clear();
    }
    source.clear();
  });

  it("omits never-loaded queries, other namespaces and queue projections", () => {
    const source = new QueryClient();
    source.getQueryCache().build(source, { queryKey: gardensKeys.byChain(11155111) });
    source.setQueryData(["wallet", "secret"], "session");
    source.setQueryData(["greengoods", "queue"], [{ id: "job" }]);
    expect(dehydrate(source, { shouldDehydrateQuery }).queries).toEqual([]);
    source.clear();
  });

  it("omits action fallbacks produced by a transient instruction fetch failure", () => {
    const source = new QueryClient();
    const fallbackActions = [{ id: "fallback", instructionsFallback: true }];
    source.setQueryData(actionsKeys.byChain(11155111), fallbackActions);

    expect(dehydrate(source, { shouldDehydrateQuery }).queries).toEqual([]);
    source.clear();
  });

  it("keeps base and work reads for the whole persistence window, independent of deploy version", () => {
    expect(QUERY_CACHE_SCHEMA_VERSION).toBe("1");
    expect(GC_TIMES.baseLists).toBeGreaterThanOrEqual(PERSIST_MAX_AGE);
    expect(GC_TIMES.works).toBeGreaterThanOrEqual(PERSIST_MAX_AGE);
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBeGreaterThanOrEqual(PERSIST_MAX_AGE);
  });

  it("refreshes a mounted stale list on reconnection without a reload", async () => {
    queryClient.mount();
    const key = gardensKeys.byChain(11155111);
    queryClient.setQueryData(key, ["cached"], { updatedAt: 1 });
    onlineManager.setOnline(false);
    const fetchList = vi.fn(async () => ["fresh"]);
    const observer = new QueryObserver(queryClient, {
      queryKey: key,
      queryFn: fetchList,
      networkMode: "online",
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(observer.getCurrentResult().data).toEqual(["cached"]);
    expect(fetchList).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(["fresh"]));
    unsubscribe();
    queryClient.unmount();
  });
});

describe("reading cache entries", () => {
  /** A Storage the tests own, so nothing leaks between cases. */
  function memoryStorage(): Storage {
    const memory = new Map<string, string>();
    return {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => [...memory.keys()][index] ?? null,
      removeItem: (key: string) => void memory.delete(key),
      setItem: (key: string, value: string) => void memory.set(key, value),
    } as Storage;
  }

  it("keeps the offline read model after seven days while ordinary reads expire", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = memoryStorage();
    const persistence = createQueryPersistence({
      dbName: "retention-test",
      storage,
      preserveQuery: isOfflineReadModelQuery,
    });
    const source = new QueryClient();
    const expiredAt = Date.now() - PERSIST_MAX_AGE - 1;
    const workRead = worksKeys.online("garden", 11155111);
    source.setQueryData(workRead, [{ id: "kept" }], { updatedAt: expiredAt });
    source.setQueryData(
      worksKeys.metadata("bafy-details"),
      { details: "kept" },
      {
        updatedAt: expiredAt,
      }
    );
    source.setQueryData(
      ["greengoods", "platform", "expired"],
      { ordinary: true },
      {
        updatedAt: expiredAt,
      }
    );
    source.setQueryData(["greengoods", "platform", "fresh"], { ordinary: true });
    for (const query of source.getQueryCache().getAll()) {
      await persistence.persistQuery(source, query.queryKey);
    }
    expect(storage.length).toBe(4);

    const restored = new QueryClient();
    await persistence.restore(restored);

    expect(restored.getQueryData(workRead)).toEqual([{ id: "kept" }]);
    expect(restored.getQueryData(worksKeys.metadata("bafy-details"))).toEqual({ details: "kept" });
    expect(restored.getQueryData(["greengoods", "platform", "expired"])).toBeUndefined();
    expect(restored.getQueryData(["greengoods", "platform", "fresh"])).toEqual({ ordinary: true });
    // The expired entry left storage during the restore, so nothing is left to collect.
    expect(storage.length).toBe(3);
    await expect(persistence.gc()).resolves.toBe(0);
    source.clear();
    restored.clear();
  });

  it("writes a settled fetch through the persister and restores it with its age", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = memoryStorage();
    const persistence = createQueryPersistence({
      dbName: "write-through",
      storage,
      shouldPersistQuery: createShouldDehydrateQuery({ excludedGroups: ["queue"] }),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { persister: persistence.persister, retry: false } },
    });
    const key = gardensKeys.byChain(11155111);

    await client.fetchQuery({ queryKey: key, queryFn: async () => [{ id: "garden" }] });
    await vi.waitFor(() => expect(storage.length).toBe(1));
    await client.fetchQuery({ queryKey: ["wallet", "secret"], queryFn: async () => "session" });
    await client.fetchQuery({ queryKey: ["greengoods", "queue"], queryFn: async () => [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storage.length).toBe(1);

    const restored = new QueryClient();
    await persistence.restore(restored);
    expect(restored.getQueryData(key)).toEqual([{ id: "garden" }]);
    expect(restored.getQueryState(key)?.dataUpdatedAt).toBe(
      client.getQueryState(key)?.dataUpdatedAt
    );
    client.clear();
    restored.clear();
  });

  it("reports a refused write-through and rejects an explicit write", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = memoryStorage();
    const onPersistenceError = vi.fn();
    const persistence = createQueryPersistence({
      dbName: "refused",
      storage,
      onPersistenceError,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { persister: persistence.persister, retry: false } },
    });
    const key = gardensKeys.byChain(11155111);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    await client.fetchQuery({ queryKey: key, queryFn: async () => ["garden"] });
    await vi.waitFor(() => expect(onPersistenceError).toHaveBeenCalledOnce());
    await expect(persistence.persistQuery(client, key)).rejects.toThrow("full");
    client.clear();
  });

  it("copies a snapshot from an earlier build into the reading cache and forgets it", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = memoryStorage();
    const source = new QueryClient();
    const remote = { id: `0x${"a".repeat(64)}`, status: "approved", _txHash: "known-approval" };
    const mergedKey = worksKeys.merged("garden", 1);
    source.setQueryData(mergedKey, [
      remote,
      { id: "0xoffline_job", status: "offline", media: ["blob:old"] },
      { id: "residual-uuid", status: "pending" },
    ]);
    source.setQueryData(["greengoods", "works", "offline", "garden", 1], ["old-job"]);
    source.setQueryData(["greengoods", "works", "mine", "account", 1, true], ["old-job"]);
    source.setQueryData(gardensKeys.byChain(1), [{ id: "garden" }]);
    storage.setItem(
      "__rq_pc__",
      JSON.stringify({ timestamp: Date.now(), buster: "dev", clientState: dehydrate(source) })
    );
    const persistence = createQueryPersistence({
      dbName: "legacy",
      storage,
      shouldRestoreQuery: (query) => isDurableWorkRead(query.queryKey),
      transformRestoredQuery: restoreDurableWorkQuery,
    });

    const restored = new QueryClient();
    await persistence.restore(restored);

    expect(restored.getQueryData(mergedKey)).toEqual([remote]);
    expect(restored.getQueryData(gardensKeys.byChain(1))).toEqual([{ id: "garden" }]);
    expect(restored.getQueryData(["greengoods", "works", "offline", "garden", 1])).toBeUndefined();
    expect(storage.getItem("__rq_pc__")).toBeNull();
    // Only the two durable reads survive in the new store.
    expect(storage.length).toBe(2);
    source.clear();
    restored.clear();
  });

  it("restores a garden read saved under a checksummed address to the lowercase key", async () => {
    const source = new QueryClient();
    const checksummed = "0xAbCd000000000000000000000000000000000001";
    source.getQueryCache().build(source, {
      queryKey: ["greengoods", "works", "online", checksummed, 1],
    });
    source.setQueryData(["greengoods", "works", "online", checksummed, 1], [{ id: "saved" }]);
    const [stored] = dehydrate(source).queries;

    const restored = restoreDurableWorkQuery(stored);
    const client = new QueryClient();
    hydrate(client, { queries: [restored], mutations: [] });

    expect(client.getQueryData(worksKeys.online(checksummed, 1))).toEqual([{ id: "saved" }]);
    source.clear();
    client.clear();
  });
});
