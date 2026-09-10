/** @vitest-environment jsdom */
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { persistQueryClientRestore } from "@tanstack/react-query-persist-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQueryPersister,
  PERSIST_MAX_AGE,
  QUERY_CACHE_SCHEMA_VERSION,
} from "@green-goods/shared/config/query-persistence";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
const { gardens: gardensKeys, actions: actionsKeys, works: worksKeys } = queryKeys;
afterEach(() => vi.unstubAllGlobals());
describe.each(["indexedDB", "storage"])("legacy migration via %s", (backend) => {
  it.each([
    "9465f61b9795",
    "dev",
  ])("hydrates compatible %s snapshots before buster validation", async (buster) => {
    if (backend === "storage") vi.stubGlobal("indexedDB", undefined);
    const source = new QueryClient();
    const keys = [
      gardensKeys.byChain(11155111),
      actionsKeys.byChain(11155111),
      worksKeys.mine("gardener", 11155111, true),
    ];
    keys.forEach((key) => source.setQueryData(key, [{ id: "cached" }]));
    const persister = createQueryPersister({
      dbName: `migration-${crypto.randomUUID()}`,
      migrateLegacyBuster: true,
    });
    const timestamp = Date.now() - 60_000;
    await persister.persistClient({ timestamp, buster, clientState: dehydrate(source) });
    const target = new QueryClient();
    const remove = vi.spyOn(persister, "removeClient");
    await persistQueryClientRestore({
      queryClient: target,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: PERSIST_MAX_AGE,
    });
    keys.forEach((key) => expect(target.getQueryData(key)).toEqual([{ id: "cached" }]));
    expect(remove).not.toHaveBeenCalled();
    expect(await persister.restoreClient()).toMatchObject({
      timestamp,
      buster: QUERY_CACHE_SCHEMA_VERSION,
    });
    source.clear();
    target.clear();
    await persister.removeClient();
  });

  it.each(["expired", "incompatible"])("still discards %s snapshots", async (reason) => {
    if (backend === "storage") vi.stubGlobal("indexedDB", undefined);
    const persister = createQueryPersister({
      dbName: `migration-${crypto.randomUUID()}`,
      migrateLegacyBuster: true,
    });
    const source = new QueryClient();
    source.setQueryData(gardensKeys.byChain(11155111), ["old"]);
    await persister.persistClient({
      timestamp: Date.now() - (reason === "expired" ? PERSIST_MAX_AGE + 1000 : 0),
      buster: reason === "expired" ? "9465f61b9795" : "2",
      clientState: dehydrate(source),
    });
    const target = new QueryClient();
    await persistQueryClientRestore({
      queryClient: target,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: PERSIST_MAX_AGE,
    });
    expect(target.getQueryCache().getAll()).toEqual([]);
    expect(await persister.restoreClient()).toBeUndefined();
    source.clear();
    target.clear();
  });
});
