/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryPersistence } from "../../config/query-persistence";
import { attachQueryPersistence } from "../../providers/QueryPersistence";
import { createTestQueryClient } from "../test-utils/query-client";

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalIndexedDB = globalThis.indexedDB;
const gardensKey = ["greengoods", "gardens", 42161] as const;

function clientWithGardens(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(gardensKey, [{ id: "garden-1" }]);
  return client;
}

function blockLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
        "SecurityError"
      );
    },
  });
}

function throwingStorage(): Storage {
  const deny = () => {
    throw new DOMException("Access is denied for this document.", "SecurityError");
  };
  return {
    length: 0,
    clear: deny,
    getItem: deny,
    key: deny,
    removeItem: deny,
    setItem: deny,
  } as unknown as Storage;
}

/** An IndexedDB whose open request never fires success, error or blocked. */
function stalledIndexedDB(): IDBFactory {
  return { open: () => ({}) as IDBOpenDBRequest } as unknown as IDBFactory;
}

function setIndexedDB(value: IDBFactory | undefined) {
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value });
}

/** A client that reads the reading cache before it fetches, wired as the apps wire theirs. */
function clientWithPersistence(persistence: ReturnType<typeof createQueryPersistence>) {
  const client = createTestQueryClient();
  attachQueryPersistence(client, persistence);
  return client;
}

function memoryStorage(): Storage {
  const memory = new Map<string, string>();
  return {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key) => memory.get(key) ?? null,
    key: (index) => [...memory.keys()][index] ?? null,
    removeItem: (key) => void memory.delete(key),
    setItem: (key, value) => void memory.set(key, value),
  } as Storage;
}

describe("query persistence resilience", () => {
  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(window, "localStorage", originalLocalStorage);
    } else {
      // biome-ignore lint/performance/noDelete: restoring the prototype accessor
      delete (window as { localStorage?: Storage }).localStorage;
    }
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: originalIndexedDB,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("still runs a query when IndexedDB never answers its open", async () => {
    vi.useFakeTimers();
    setIndexedDB(stalledIndexedDB());
    const persistence = createQueryPersistence({
      dbName: `gg-stalled-idb-${crypto.randomUUID()}`,
      storage: memoryStorage(),
    });
    const client = clientWithPersistence(persistence);
    const gardensFn = vi.fn(async () => [{ id: "garden-1" }]);

    const gardens = client.fetchQuery({ queryKey: gardensKey, queryFn: gardensFn });
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(gardens).resolves.toEqual([{ id: "garden-1" }]);
    expect(gardensFn).toHaveBeenCalledTimes(1);

    // The stalled tier stays demoted for the session, so a later read does not wait again.
    let settled = false;
    const actions = client
      .fetchQuery({ queryKey: ["greengoods", "actions", 42161], queryFn: async () => [] })
      .then((value) => {
        settled = true;
        return value;
      });
    await vi.advanceTimersByTimeAsync(10);
    expect(settled).toBe(true);
    await expect(actions).resolves.toEqual([]);
    client.clear();
  });

  it("sends a burst of stalled reads to web storage without skipping past it", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    setIndexedDB(undefined);
    const seed = createQueryPersistence({ dbName: `gg-seed-${crypto.randomUUID()}`, storage });
    const source = clientWithGardens();
    await seed.persistQuery(source, gardensKey);
    expect(storage.length).toBe(1);

    setIndexedDB(stalledIndexedDB());
    const persistence = createQueryPersistence({
      dbName: `gg-stalled-burst-${crypto.randomUUID()}`,
      storage,
    });
    const client = clientWithPersistence(persistence);
    const fetched: string[] = [];
    // The five reads the admin's access check starts together at boot, gardens last.
    const keys = [
      ["greengoods", "actions", 42161],
      ["greengoods", "gardeners"],
      ["greengoods", "role", "stewardGardens", "0xabc", 42161],
      ["greengoods", "role", "deploymentPermissions", "0xabc", 42161],
      gardensKey,
    ] as const;
    const reads = keys.map((queryKey) =>
      client.fetchQuery({
        queryKey,
        queryFn: async () => {
          fetched.push(queryKey.join("/"));
          return [];
        },
      })
    );
    await vi.advanceTimersByTimeAsync(3_000);
    const values = await Promise.all(reads);

    // Web storage still answers after the stall, so the stored gardens read comes from it.
    expect(values.at(-1)).toEqual([{ id: "garden-1" }]);
    expect(fetched).not.toContain(gardensKey.join("/"));
    expect(fetched).toHaveLength(4);
    source.clear();
    client.clear();
  });

  it("builds a working reading cache when merely reading window.localStorage throws", async () => {
    blockLocalStorage();
    expect(() => window.localStorage).toThrow(/Access is denied/);

    const persistence = createQueryPersistence({
      dbName: `gg-boot-blocked-${crypto.randomUUID()}`,
    });
    const source = clientWithGardens();
    await persistence.persistQuery(source, gardensKey);
    const restored = new QueryClient();
    await persistence.restore(restored);
    expect(restored.getQueryData(gardensKey)).toEqual([{ id: "garden-1" }]);

    await persistence.clear();
    const emptied = new QueryClient();
    await persistence.restore(emptied);
    expect(emptied.getQueryData(gardensKey)).toBeUndefined();
    source.clear();
    restored.clear();
  });

  it("degrades to an in-memory session when IndexedDB and web storage both fail", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const persistence = createQueryPersistence({
      dbName: "gg-boot-no-storage",
      storage: throwingStorage(),
    });
    const source = clientWithGardens();
    await expect(persistence.persistQuery(source, gardensKey)).resolves.toBeUndefined();
    await expect(persistence.restore(new QueryClient())).resolves.toBeUndefined();
    await expect(persistence.gc()).resolves.toBe(0);
    await expect(persistence.clear()).resolves.toBeUndefined();
    source.clear();
  });

  it("falls back when IndexedDB fails asynchronously on its first operation", async () => {
    const request = {
      error: new DOMException("IndexedDB is blocked", "SecurityError"),
    } as unknown as IDBOpenDBRequest;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: {
        open: () => {
          queueMicrotask(() => request.onerror?.(new Event("error")));
          return request;
        },
      } as unknown as IDBFactory,
    });
    const storage = memoryStorage();
    const persistence = createQueryPersistence({
      dbName: `gg-async-idb-failure-${crypto.randomUUID()}`,
      storage,
    });
    const source = clientWithGardens();

    await expect(persistence.persistQuery(source, gardensKey)).resolves.toBeUndefined();
    expect(storage.length).toBe(1);
    const restored = new QueryClient();
    await persistence.restore(restored);
    expect(restored.getQueryData(gardensKey)).toEqual([{ id: "garden-1" }]);
    source.clear();
    restored.clear();
  });

  it("keeps an explicitly supplied storage without touching window.localStorage", async () => {
    blockLocalStorage();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const storage = memoryStorage();

    const persistence = createQueryPersistence({ dbName: "gg-boot-memory", storage });
    const source = clientWithGardens();
    await persistence.persistQuery(source, gardensKey);
    expect(storage.length).toBe(1);
    const restored = new QueryClient();
    await persistence.restore(restored);
    expect(restored.getQueryData(gardensKey)).toEqual([{ id: "garden-1" }]);
    source.clear();
    restored.clear();
  });
});
