/** @vitest-environment jsdom */

import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryPersister, type PersistedClient } from "../../config/query-persistence";

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalIndexedDB = globalThis.indexedDB;

function persistedClient(): PersistedClient {
  const source = new QueryClient();
  source.setQueryData(["greengoods", "gardens", 42161], [{ id: "garden-1" }]);
  const client = { timestamp: Date.now(), buster: "boot", clientState: dehydrate(source) };
  source.clear();
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

  it("builds a working persister when merely reading window.localStorage throws", async () => {
    blockLocalStorage();
    expect(() => window.localStorage).toThrow(/Access is denied/);

    const persister = createQueryPersister({ dbName: `gg-boot-blocked-${crypto.randomUUID()}` });
    const client = persistedClient();
    await persister.persistClient(client);
    await expect(persister.restoreClient()).resolves.toEqual(client);
    await persister.removeClient();
    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("degrades to an in-memory session when IndexedDB and web storage both fail", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const persister = createQueryPersister({
      dbName: "gg-boot-no-storage",
      storage: throwingStorage(),
    });
    await expect(persister.persistClient(persistedClient())).resolves.toBeUndefined();
    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(persister.removeClient()).resolves.toBeUndefined();
  });

  it("keeps an explicitly supplied storage without touching window.localStorage", async () => {
    blockLocalStorage();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const memory = new Map<string, string>();
    const storage = {
      length: 0,
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      key: () => null,
      removeItem: (key: string) => void memory.delete(key),
      setItem: (key: string, value: string) => void memory.set(key, value),
    } as unknown as Storage;

    const persister = createQueryPersister({ dbName: "gg-boot-memory", storage });
    const client = persistedClient();
    await persister.persistClient(client);
    await expect(persister.restoreClient()).resolves.toEqual(client);
  });
});
