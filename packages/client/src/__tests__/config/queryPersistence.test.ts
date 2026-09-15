/** @vitest-environment jsdom */
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQueryPersistence,
  PERSIST_MAX_AGE,
} from "@green-goods/shared/config/query-persistence";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { createStore, set as idbSet } from "idb-keyval";
const { gardens: gardensKeys, actions: actionsKeys, works: worksKeys } = queryKeys;
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function writeLegacySnapshot(
  backend: string,
  legacy: { dbName: string; storeName: string },
  snapshot: { timestamp: number; buster: string; clientState: ReturnType<typeof dehydrate> }
) {
  if (backend === "storage") window.localStorage.setItem("__rq_pc__", JSON.stringify(snapshot));
  else await idbSet("__rq_pc__", snapshot, createStore(legacy.dbName, legacy.storeName));
}

describe.each(["indexedDB", "storage"])("legacy migration via %s", (backend) => {
  it.each([
    "9465f61b9795",
    "dev",
  ])("hydrates compatible %s snapshots into the reading cache", async (buster) => {
    if (backend === "storage") vi.stubGlobal("indexedDB", undefined);
    const suffix = crypto.randomUUID();
    const legacy = { dbName: `migration-legacy-${suffix}`, storeName: "rq" };
    const source = new QueryClient();
    const keys = [
      gardensKeys.byChain(11155111),
      actionsKeys.byChain(11155111),
      worksKeys.mine("gardener", 11155111, true),
    ];
    keys.forEach((key) => source.setQueryData(key, [{ id: "cached" }]));
    await writeLegacySnapshot(backend, legacy, {
      timestamp: Date.now() - 60_000,
      buster,
      clientState: dehydrate(source),
    });
    const persistence = createQueryPersistence({ dbName: `migration-${suffix}`, legacy });
    const target = new QueryClient();
    await persistence.restore(target);
    keys.forEach((key) => expect(target.getQueryData(key)).toEqual([{ id: "cached" }]));
    source.clear();
    target.clear();
    await persistence.clear();
  });

  it.each(["expired", "incompatible"])("still discards %s snapshots", async (reason) => {
    if (backend === "storage") vi.stubGlobal("indexedDB", undefined);
    const suffix = crypto.randomUUID();
    const legacy = { dbName: `migration-legacy-${suffix}`, storeName: "rq" };
    const source = new QueryClient();
    source.setQueryData(gardensKeys.byChain(11155111), ["old"], {
      updatedAt: Date.now() - (reason === "expired" ? PERSIST_MAX_AGE + 1000 : 0),
    });
    await writeLegacySnapshot(backend, legacy, {
      timestamp: Date.now() - (reason === "expired" ? PERSIST_MAX_AGE + 1000 : 0),
      buster: reason === "expired" ? "9465f61b9795" : "2",
      clientState: dehydrate(source),
    });
    const persistence = createQueryPersistence({ dbName: `migration-${suffix}`, legacy });
    const target = new QueryClient();
    await persistence.restore(target);
    expect(target.getQueryCache().getAll()).toEqual([]);
    const again = new QueryClient();
    await persistence.restore(again);
    expect(again.getQueryCache().getAll()).toEqual([]);
    source.clear();
    target.clear();
    await persistence.clear();
  });
});
