/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryPersistence } from "../../config/query-persistence";

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
    vi.restoreAllMocks();
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
      } as IDBFactory,
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
