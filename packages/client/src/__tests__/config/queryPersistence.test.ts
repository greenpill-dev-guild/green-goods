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

describe("legacy migration under storage pressure", () => {
  it("keeps the snapshot when a record could not be rewritten", async () => {
    // Web-storage backend so the failing write can be injected directly.
    vi.stubGlobal("indexedDB", undefined);
    const suffix = crypto.randomUUID();
    const legacy = { dbName: `migration-legacy-${suffix}`, storeName: "rq" };
    const source = new QueryClient();
    const key = gardensKeys.byChain(11155111);
    source.setQueryData(key, [{ id: "cached" }]);
    const snapshot = JSON.stringify({
      timestamp: Date.now() - 60_000,
      buster: "9465f61b9795",
      clientState: dehydrate(source),
    });

    const shelf = new Map<string, string>([["__rq_pc__", snapshot]]);
    let refuseWrites = true;
    const storage = {
      get length() {
        return shelf.size;
      },
      clear: () => shelf.clear(),
      getItem: (k: string) => shelf.get(k) ?? null,
      key: (index: number) => [...shelf.keys()][index] ?? null,
      removeItem: (k: string) => void shelf.delete(k),
      setItem: (k: string, value: string) => {
        // Full only for the per-query rewrite; the snapshot itself is already there.
        if (refuseWrites && k !== "__rq_pc__") {
          throw new DOMException("quota", "QuotaExceededError");
        }
        shelf.set(k, value);
      },
    } as unknown as Storage;

    await createQueryPersistence({ dbName: `migration-${suffix}`, legacy, storage }).restore(
      new QueryClient()
    );

    // The only copy has to survive a rewrite that did not finish: an offline
    // reader whose snapshot was deleted has no read model and cannot fetch one.
    expect(shelf.has("__rq_pc__")).toBe(true);

    refuseWrites = false;
    const recovered = new QueryClient();
    await createQueryPersistence({ dbName: `migration-${suffix}`, legacy, storage }).restore(
      recovered
    );
    expect(recovered.getQueryData(key)).toEqual([{ id: "cached" }]);

    source.clear();
    recovered.clear();
  });
});
