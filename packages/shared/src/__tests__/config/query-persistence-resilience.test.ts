/** @vitest-environment jsdom */

import { hashKey, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type CreateQueryPersistenceOptions,
  createQueryPersistence,
  type StoredQuery,
} from "../../config/query-persistence";
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

/** Another feature's record in the same web storage, shaped like a persisted draft store. */
const commitmentDraft = JSON.stringify({ state: { drafts: { garden: "notes" } }, version: 0 });

/**
 * Stall one database the way an origin stalls in the field: a delete waits on
 * a connection that ignores `versionchange`, and every later open queues
 * behind it. Closing that connection lets the delete through, and IndexedDB
 * then answers everything that waited, however late.
 */
async function stallIndexedDB(dbName: string): Promise<() => void> {
  const request = indexedDB.open(dbName);
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await vi.advanceTimersByTimeAsync(10);
  const connection = await opened;
  connection.onversionchange = () => undefined;
  indexedDB.deleteDatabase(dbName);
  return () => connection.close();
}

/** The gardens answer the reading cache holds in web storage. */
function webGardens(storage: Storage): unknown {
  const record = storage.getItem(`gg-${hashKey(gardensKey)}`);
  return record ? (JSON.parse(record) as StoredQuery).state.data : undefined;
}

/** What a launch over these stores restores for the gardens read. */
async function launchAndReadGardens(options: CreateQueryPersistenceOptions): Promise<unknown> {
  const client = createTestQueryClient();
  // The shared test client collects idle reads at once; keep this one to read it back.
  client.setQueryDefaults(gardensKey, { gcTime: Number.POSITIVE_INFINITY });
  const restored = createQueryPersistence(options).restore(client);
  await vi.advanceTimersByTimeAsync(100);
  await restored;
  return client.getQueryData(gardensKey);
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

  it("does not report storage as full when web storage keeps the write after a stall", async () => {
    vi.useFakeTimers();
    setIndexedDB(stalledIndexedDB());
    const storage = memoryStorage();
    const onPersistenceError = vi.fn();
    const persistence = createQueryPersistence({
      dbName: `gg-stalled-report-${crypto.randomUUID()}`,
      storage,
      onPersistenceError,
    });
    const client = clientWithPersistence(persistence);

    const gardens = client.fetchQuery({
      queryKey: gardensKey,
      queryFn: async () => [{ id: "garden-1" }],
    });
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(gardens).resolves.toEqual([{ id: "garden-1" }]);
    // The persister writes the settled read on a later tick.
    await vi.advanceTimersByTimeAsync(10);

    expect(storage.length).toBe(1);
    expect(onPersistenceError).not.toHaveBeenCalled();
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

  it("keeps the newest answer when IndexedDB answers after the deadline", async () => {
    vi.useFakeTimers();
    const dbName = `gg-late-idb-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    storage.setItem("gg-commitment-proof-drafts", commitmentDraft);
    const answerStalledOperations = await stallIndexedDB(dbName);
    const persistence = createQueryPersistence({ dbName, storage });
    const source = createTestQueryClient();
    const startedAt = Date.now();

    // Boot's restore meets the stall first, so IndexedDB is demoted at 3s.
    void persistence.restore(createTestQueryClient());
    await vi.advanceTimersByTimeAsync(1_000);
    source.setQueryData(gardensKey, [{ id: "older" }], { updatedAt: startedAt + 1_000 });
    const olderWrite = persistence.persistQuery(source, gardensKey);
    await vi.advanceTimersByTimeAsync(2_500);
    source.setQueryData(gardensKey, [{ id: "newer" }], { updatedAt: startedAt + 3_500 });
    await persistence.persistQuery(source, gardensKey);
    // The older write reaches web storage only at its own 4s deadline, after the newer one.
    await vi.advanceTimersByTimeAsync(1_000);
    await olderWrite;
    expect(webGardens(storage)).toEqual([{ id: "newer" }]);

    // IndexedDB answers what waited, and the abandoned older write lands there.
    answerStalledOperations();
    await vi.advanceTimersByTimeAsync(100);
    await expect(launchAndReadGardens({ dbName, storage: undefined })).resolves.toEqual([
      { id: "older" },
    ]);

    // The next launch prefers IndexedDB again, yet restores the newer answer and moves it there.
    await expect(launchAndReadGardens({ dbName, storage })).resolves.toEqual([{ id: "newer" }]);
    await expect(launchAndReadGardens({ dbName, storage: undefined })).resolves.toEqual([
      { id: "newer" },
    ]);
    expect(storage.length).toBe(1);
    expect(storage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
    source.clear();
  });

  it("leaves other features' web storage alone while IndexedDB is stalled", async () => {
    vi.useFakeTimers();
    setIndexedDB(stalledIndexedDB());
    const storage = memoryStorage();
    storage.setItem("gg-commitment-proof-drafts", commitmentDraft);
    storage.setItem("gg-pwa-installed", "true");
    const persistence = createQueryPersistence({
      dbName: `gg-stalled-neighbours-${crypto.randomUUID()}`,
      storage,
    });

    const collected = persistence.gc();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(collected).resolves.toBe(0);
    const source = clientWithGardens();
    await persistence.persistQuery(source, gardensKey);
    expect(storage.length).toBe(3);
    await persistence.clear();

    expect(storage.length).toBe(2);
    expect(storage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
    expect(storage.getItem("gg-pwa-installed")).toBe("true");
    source.clear();
  });

  it("clears the copies an earlier session left in web storage", async () => {
    vi.useFakeTimers();
    const dbName = `gg-clear-tiers-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const source = clientWithGardens();
    setIndexedDB(undefined);
    await createQueryPersistence({ dbName, storage }).persistQuery(source, gardensKey);
    setIndexedDB(originalIndexedDB);

    const cleared = createQueryPersistence({ dbName, storage }).clear();
    await vi.advanceTimersByTimeAsync(100);
    await cleared;

    await expect(launchAndReadGardens({ dbName, storage })).resolves.toBeUndefined();
    source.clear();
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
