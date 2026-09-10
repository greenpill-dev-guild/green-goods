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
