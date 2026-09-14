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
  createShouldDehydrateQuery,
  PERSIST_MAX_AGE,
  QUERY_CACHE_SCHEMA_VERSION,
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

describe("offline read model retention", () => {
  it("keeps the offline read model after seven days while unrelated reads expire", async () => {
    const { createQueryPersister, isOfflineReadModelQuery } = await import(
      "../../config/query-persistence"
    );
    vi.stubGlobal("indexedDB", undefined);
    const source = new QueryClient();
    const workRead = worksKeys.online("garden", 11155111);
    source.setQueryData(workRead, [{ id: "kept" }]);
    source.setQueryData(worksKeys.metadata("bafy-details"), { details: "kept" });
    source.setQueryData(["greengoods", "platform", "stats"], { ordinary: true });
    const storage = window.localStorage;
    storage.clear();
    const persister = createQueryPersister({
      dbName: "retention-test",
      storage,
      preserveQuery: (query) => isOfflineReadModelQuery(query.queryKey),
    });
    await persister.persistClientVerified!({
      timestamp: Date.now() - PERSIST_MAX_AGE - 1,
      buster: "1",
      clientState: dehydrate(source),
    });
    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries.map((entry) => entry.queryKey)).toEqual([
      workRead,
      worksKeys.metadata("bafy-details"),
    ]);
    source.clear();
    storage.clear();
  });

  it("restores a garden read saved under a checksummed address to the lowercase key", async () => {
    const { restoreDurableWorkQuery } = await import("../../config/query-persistence");
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

describe("persisted snapshot writes", () => {
  function fakeStorage() {
    const writes: string[] = [];
    const storage = {
      getItem: vi.fn(() => writes.at(-1) ?? null),
      setItem: vi.fn((_key: string, value: string) => {
        writes.push(value);
      }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    return { storage, writes };
  }
  const snapshot = (label: string) => ({
    timestamp: Date.now(),
    buster: "1",
    clientState: { queries: [], mutations: [], label } as never,
  });

  it("writes only the newest snapshot of a burst, then waits for the interval", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", undefined);
    const { createQueryPersister } = await import("../../config/query-persistence");
    const { storage, writes } = fakeStorage();
    const persister = createQueryPersister({ dbName: "burst", storage, writeIntervalMs: 1_000 });

    const first = persister.persistClient(snapshot("first"));
    await vi.advanceTimersByTimeAsync(0);
    const burst = ["second", "third", "fourth"].map((label) =>
      persister.persistClient(snapshot(label))
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, ...burst]);

    expect(writes.map((value) => JSON.parse(value).clientState.label)).toEqual(["first", "fourth"]);
    vi.useRealTimers();
  });

  it("writes an explicit flush without waiting and reports its failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", undefined);
    const { createQueryPersister } = await import("../../config/query-persistence");
    const { storage, writes } = fakeStorage();
    const persister = createQueryPersister({ dbName: "flush", storage, writeIntervalMs: 60_000 });

    await persister.persistClient(snapshot("ordinary"));
    await persister.persistClientVerified!(snapshot("flushed"));
    expect(writes.map((value) => JSON.parse(value).clientState.label)).toEqual([
      "ordinary",
      "flushed",
    ]);

    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(persister.persistClientVerified!(snapshot("full"))).rejects.toThrow("full");
    vi.useRealTimers();
  });
});

it("rebuilds old local projections while preserving remote approval overlays", async () => {
  const { createQueryPersister, isDurableWorkRead, restoreDurableWorkQuery } = await import(
    "../../config/query-persistence"
  );
  vi.stubGlobal("indexedDB", undefined);
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
  const persister = createQueryPersister({
    dbName: "test-projections",
    storage: window.localStorage,
    shouldRestoreQuery: (query) => isDurableWorkRead(query.queryKey),
    transformRestoredQuery: restoreDurableWorkQuery,
  });
  await persister.persistClient({
    timestamp: Date.now(),
    buster: "1",
    clientState: dehydrate(source),
  });
  const restored = await persister.restoreClient();
  expect(restored?.clientState.queries).toHaveLength(1);
  expect(restored?.clientState.queries[0].state.data).toEqual([remote]);
  source.clear();
});
