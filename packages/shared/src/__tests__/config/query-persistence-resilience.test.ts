/** @vitest-environment jsdom */

import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type CreateQueryPersistenceOptions,
  clearPersistedQueryClient,
  createQueryPersistence,
  isDurableWorkRead,
  QUERY_CACHE_SCHEMA_VERSION,
  restoreDurableWorkQuery,
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
 * Stall one database the way an origin stalls in the field: an upgrade waits
 * on a connection that ignores `versionchange`, and every later open queues
 * behind it. Closing that connection lets the upgrade through, and IndexedDB
 * then answers everything that waited, however late. The gardens answer an
 * earlier session stored an hour ago stays in the database throughout.
 */
async function stallIndexedDB(dbName: string, earlierGardens: unknown): Promise<() => void> {
  const opening = indexedDB.open(dbName);
  opening.onupgradeneeded = () => opening.result.createObjectStore("queries");
  const opened = new Promise<IDBDatabase>((resolve) => {
    opening.onsuccess = () => resolve(opening.result);
  });
  await vi.advanceTimersByTimeAsync(10);
  const holder = await opened;
  const earlier = createTestQueryClient();
  earlier.setQueryData(gardensKey, earlierGardens, { updatedAt: Date.now() - 60 * 60 * 1000 });
  const record = {
    queryKey: [...gardensKey],
    queryHash: hashKey(gardensKey),
    state: earlier.getQueryState(gardensKey),
    buster: QUERY_CACHE_SCHEMA_VERSION,
  };
  holder
    .transaction("queries", "readwrite")
    .objectStore("queries")
    .put(record, `gg-${record.queryHash}`);
  await vi.advanceTimersByTimeAsync(10);
  holder.onversionchange = () => undefined;
  const upgrade = indexedDB.open(dbName, holder.version + 1);
  upgrade.onsuccess = () => upgrade.result.close();
  return () => holder.close();
}

/** The gardens answer the reading cache holds in web storage. */
function webGardens(storage: Storage): unknown {
  const record = storage.getItem(`gg-${hashKey(gardensKey)}`);
  return record ? (JSON.parse(record) as StoredQuery).state.data : undefined;
}

/** What a launch over these stores restores for one read, the gardens read unless named. */
async function launchAndRead(
  options: CreateQueryPersistenceOptions,
  queryKey: QueryKey = gardensKey
): Promise<unknown> {
  const client = createTestQueryClient();
  // The shared test client collects idle reads at once; keep this one to read it back.
  client.setQueryDefaults(queryKey, { gcTime: Number.POSITIVE_INFINITY });
  const restored = createQueryPersistence(options).restore(client);
  await vi.advanceTimersByTimeAsync(100);
  await restored;
  return client.getQueryData(queryKey);
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
    const answerStalledOperations = await stallIndexedDB(dbName, [{ id: "earlier" }]);
    const persistence = createQueryPersistence({ dbName, storage });
    const source = createTestQueryClient();
    const startedAt = Date.now();

    // Boot's restore meets the stall first, so IndexedDB is demoted at 3s.
    void persistence.restore(createTestQueryClient());
    await vi.advanceTimersByTimeAsync(1_000);
    source.setQueryData(gardensKey, [{ id: "abandoned" }], { updatedAt: startedAt + 1_000 });
    const abandonedWrite = persistence.persistQuery(source, gardensKey);
    await vi.advanceTimersByTimeAsync(2_500);
    source.setQueryData(gardensKey, [{ id: "newer" }], { updatedAt: startedAt + 3_500 });
    await persistence.persistQuery(source, gardensKey);
    // The abandoned write reaches web storage only at its own 4s deadline, after the newer one.
    await vi.advanceTimersByTimeAsync(1_000);
    await abandonedWrite;
    expect(webGardens(storage)).toEqual([{ id: "newer" }]);

    // IndexedDB answers what waited, but the abandoned write is stale by then and stays out.
    answerStalledOperations();
    await vi.advanceTimersByTimeAsync(100);
    await expect(launchAndRead({ dbName, storage: undefined })).resolves.toEqual([
      { id: "earlier" },
    ]);

    // The next launch prefers IndexedDB again, yet restores the newer answer and moves it there.
    await expect(launchAndRead({ dbName, storage })).resolves.toEqual([{ id: "newer" }]);
    await expect(launchAndRead({ dbName, storage: undefined })).resolves.toEqual([{ id: "newer" }]);
    expect(storage.length).toBe(1);
    expect(storage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
    source.clear();
  });

  it("keeps the newer answer when a demoted IndexedDB answers a read late", async () => {
    vi.useFakeTimers();
    const dbName = `gg-demoted-read-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const answerStalledOperations = await stallIndexedDB(dbName, [{ id: "earlier" }]);
    const persistence = createQueryPersistence({ dbName, storage });
    const client = clientWithPersistence(persistence);
    const source = createTestQueryClient();

    // Boot's restore meets the stall at 0s, and a screen's read reaches IndexedDB at 1.5s.
    void persistence.restore(createTestQueryClient());
    await vi.advanceTimersByTimeAsync(1_500);
    const gardens = client.fetchQuery({ queryKey: gardensKey, queryFn: async () => [] });
    // The restore demotes IndexedDB at 3s, and a newer answer reaches web storage.
    await vi.advanceTimersByTimeAsync(1_700);
    source.setQueryData(gardensKey, [{ id: "newer" }]);
    await persistence.persistQuery(source, gardensKey);
    // IndexedDB answers the waiting read before that read's own 4.5s deadline.
    answerStalledOperations();
    await vi.advanceTimersByTimeAsync(100);

    await expect(gardens).resolves.toEqual([{ id: "newer" }]);
    client.clear();
    source.clear();
  });

  it("keeps a web copy another tab rewrote while this launch reconciled it", async () => {
    vi.useFakeTimers();
    const dbName = `gg-reconcile-race-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const source = createTestQueryClient();
    const startedAt = Date.now();
    setIndexedDB(undefined);
    const otherTab = createQueryPersistence({ dbName, storage });
    setIndexedDB(originalIndexedDB);
    source.setQueryData(gardensKey, [{ id: "listed" }], { updatedAt: startedAt });
    await otherTab.persistQuery(source, gardensKey);

    // The launch lists web storage, then the other tab rewrites the key before the fold ends.
    const restored = createQueryPersistence({ dbName, storage }).restore(createTestQueryClient());
    source.setQueryData(gardensKey, [{ id: "rewritten" }], { updatedAt: startedAt + 1_000 });
    await otherTab.persistQuery(source, gardensKey);
    await vi.advanceTimersByTimeAsync(100);
    await restored;

    expect(webGardens(storage)).toEqual([{ id: "rewritten" }]);
    await expect(launchAndRead({ dbName, storage })).resolves.toEqual([{ id: "rewritten" }]);
    source.clear();
  });

  it("does not let a copy this build would not restore replace the IndexedDB copy", async () => {
    vi.useFakeTimers();
    const dbName = `gg-reconcile-schema-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const source = createTestQueryClient();
    source.setQueryData(gardensKey, [{ id: "this build" }]);
    const kept = createQueryPersistence({ dbName, storage: undefined }).persistQuery(
      source,
      gardensKey
    );
    await vi.advanceTimersByTimeAsync(100);
    await kept;
    // An older build still open on web storage writes a later answer under another cache schema.
    setIndexedDB(undefined);
    source.setQueryData(gardensKey, [{ id: "older build" }], { updatedAt: Date.now() + 1_000 });
    await createQueryPersistence({ dbName, storage, buster: "0" }).persistQuery(source, gardensKey);
    setIndexedDB(originalIndexedDB);

    await expect(launchAndRead({ dbName, storage })).resolves.toEqual([{ id: "this build" }]);
    expect(storage.length).toBe(0);
    source.clear();
  });

  it("replays a write IndexedDB takes after another operation demoted it", async () => {
    vi.useFakeTimers();
    const dbName = `gg-replayed-write-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const answerStalledOperations = await stallIndexedDB(dbName, [{ id: "earlier" }]);
    const persistence = createQueryPersistence({ dbName, storage });
    const source = createTestQueryClient();

    // Boot's restore meets the stall at 0s, and a write reaches IndexedDB at 1s.
    void persistence.restore(createTestQueryClient());
    await vi.advanceTimersByTimeAsync(1_000);
    source.setQueryData(gardensKey, [{ id: "written" }]);
    const written = persistence.persistQuery(source, gardensKey);
    // The restore demotes IndexedDB at 3s, and IndexedDB takes the write before its 4s deadline.
    await vi.advanceTimersByTimeAsync(2_500);
    answerStalledOperations();
    await vi.advanceTimersByTimeAsync(100);
    await written;

    // The session now reads web storage, so the write has to be there too.
    expect(webGardens(storage)).toEqual([{ id: "written" }]);
    source.clear();
  });

  it("finishes a clear IndexedDB takes after another operation demoted it", async () => {
    vi.useFakeTimers();
    const dbName = `gg-late-clear-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const source = clientWithGardens();
    setIndexedDB(undefined);
    await createQueryPersistence({ dbName, storage }).persistQuery(source, gardensKey);
    setIndexedDB(originalIndexedDB);
    const answerStalledOperations = await stallIndexedDB(dbName, [{ id: "earlier" }]);
    const persistence = createQueryPersistence({ dbName, storage });

    // Boot's restore meets the stall at 0s, and the clear reaches IndexedDB at 1s.
    void persistence.restore(createTestQueryClient());
    await vi.advanceTimersByTimeAsync(1_000);
    const cleared = persistence.clear();
    // The restore demotes IndexedDB at 3s, and IndexedDB takes the clear before its 4s deadline.
    await vi.advanceTimersByTimeAsync(2_500);
    answerStalledOperations();
    await vi.advanceTimersByTimeAsync(100);

    await expect(cleared).resolves.toBeUndefined();
    expect(storage.length).toBe(0);
    await expect(launchAndRead({ dbName, storage })).resolves.toBeUndefined();
    source.clear();
  });

  it("reads a key's newer web copy before reconcile has reached it", async () => {
    vi.useFakeTimers();
    const dbName = `gg-unreconciled-read-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const actionsKey = ["greengoods", "actions", 42161] as const;
    const startedAt = Date.now();
    const source = createTestQueryClient();
    const earlierSession = createQueryPersistence({ dbName, storage: undefined });
    for (const queryKey of [gardensKey, actionsKey]) {
      source.setQueryData(queryKey, [{ id: "earlier" }], { updatedAt: startedAt });
      const written = earlierSession.persistQuery(source, queryKey);
      await vi.advanceTimersByTimeAsync(10);
      await written;
    }
    // A stalled session then wrote newer answers for both to web storage.
    setIndexedDB(undefined);
    const stalledSession = createQueryPersistence({ dbName, storage });
    for (const queryKey of [gardensKey, actionsKey]) {
      source.setQueryData(queryKey, [{ id: "newer" }], { updatedAt: startedAt + 1_000 });
      await stalledSession.persistQuery(source, queryKey);
    }
    setIndexedDB(originalIndexedDB);

    // The next launch reconciles gardens first; a screen reads actions before it gets there.
    const persistence = createQueryPersistence({ dbName, storage });
    void persistence.restore(createTestQueryClient());
    const actions = clientWithPersistence(persistence).fetchQuery({
      queryKey: actionsKey,
      queryFn: async () => [],
    });
    await vi.advanceTimersByTimeAsync(100);

    await expect(actions).resolves.toEqual([{ id: "newer" }]);
    source.clear();
  });

  it("keeps a newer answer at the key a restored record moves to", async () => {
    vi.useFakeTimers();
    const dbName = `gg-moved-record-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const checksummed = ["greengoods", "works", "online", "0xAbC", 42161] as const;
    const lowercase = ["greengoods", "works", "online", "0xabc", 42161] as const;
    const source = createTestQueryClient();
    const startedAt = Date.now();
    source.setQueryData(lowercase, [{ id: "newer" }], { updatedAt: startedAt });
    const kept = createQueryPersistence({ dbName, storage: undefined }).persistQuery(
      source,
      lowercase
    );
    await vi.advanceTimersByTimeAsync(100);
    await kept;
    // A build from before the lowercase key left an older answer in web storage.
    setIndexedDB(undefined);
    source.setQueryData(checksummed, [{ id: "older" }], { updatedAt: startedAt - 1_000 });
    await createQueryPersistence({ dbName, storage }).persistQuery(source, checksummed);
    setIndexedDB(originalIndexedDB);

    const options = { dbName, storage, transformRestoredQuery: restoreDurableWorkQuery };
    await expect(launchAndRead(options, lowercase)).resolves.toEqual([{ id: "newer" }]);
    await expect(launchAndRead({ ...options, storage: undefined }, lowercase)).resolves.toEqual([
      { id: "newer" },
    ]);
    source.clear();
  });

  it("does not serve a copy the restore policy excludes while reconcile runs", async () => {
    vi.useFakeTimers();
    const dbName = `gg-excluded-read-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const projection = ["greengoods", "works", "offline", "0xabc", 42161] as const;
    const source = createTestQueryClient();
    // An earlier session on web storage kept gardens and a local queue projection.
    setIndexedDB(undefined);
    const earlierSession = createQueryPersistence({ dbName, storage });
    for (const queryKey of [gardensKey, projection]) {
      source.setQueryData(queryKey, [{ id: "stored" }]);
      await earlierSession.persistQuery(source, queryKey);
    }
    setIndexedDB(originalIndexedDB);

    // The next launch reconciles gardens first; a screen reads the projection meanwhile.
    const persistence = createQueryPersistence({
      dbName,
      storage,
      shouldRestoreQuery: (stored) => isDurableWorkRead(stored.queryKey),
    });
    void persistence.restore(createTestQueryClient());
    const read = clientWithPersistence(persistence).fetchQuery({
      queryKey: projection,
      queryFn: async () => [{ id: "rebuilt" }],
    });
    await vi.advanceTimersByTimeAsync(100);

    await expect(read).resolves.toEqual([{ id: "rebuilt" }]);
    source.clear();
  });

  it("does not let an IndexedDB copy this build would not restore beat a valid web copy", async () => {
    vi.useFakeTimers();
    const dbName = `gg-reconcile-preferred-schema-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    const source = createTestQueryClient();
    // An older build still open wrote a later answer to IndexedDB under another cache schema.
    source.setQueryData(gardensKey, [{ id: "older build" }], { updatedAt: Date.now() + 1_000 });
    const olderBuild = createQueryPersistence({
      dbName,
      storage: undefined,
      buster: "0",
    }).persistQuery(source, gardensKey);
    await vi.advanceTimersByTimeAsync(100);
    await olderBuild;
    // This build, during an earlier stall, kept a valid answer in web storage.
    setIndexedDB(undefined);
    source.setQueryData(gardensKey, [{ id: "this build" }]);
    await createQueryPersistence({ dbName, storage }).persistQuery(source, gardensKey);
    setIndexedDB(originalIndexedDB);

    await expect(launchAndRead({ dbName, storage })).resolves.toEqual([{ id: "this build" }]);
    await expect(launchAndRead({ dbName, storage: undefined })).resolves.toEqual([
      { id: "this build" },
    ]);
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

    expect(storage.length).toBe(2);
    expect(storage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
    expect(storage.getItem("gg-pwa-installed")).toBe("true");
  });

  it("keeps drafts and settings when the boot recovery clears cached data", async () => {
    const dbName = `gg-reset-${crypto.randomUUID()}`;
    setIndexedDB(undefined);
    window.localStorage.clear();
    window.localStorage.setItem("gg-commitment-proof-drafts", commitmentDraft);
    window.localStorage.setItem("gg-language", "pt");
    window.localStorage.setItem("__rq_pc__", "{}");
    const source = clientWithGardens();
    await createQueryPersistence({ dbName }).persistQuery(source, gardensKey);
    expect(window.localStorage.length).toBe(4);

    await clearPersistedQueryClient({ dbName });

    expect(window.localStorage.length).toBe(2);
    expect(window.localStorage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
    expect(window.localStorage.getItem("gg-language")).toBe("pt");
    window.localStorage.clear();
    source.clear();
  });

  it("does not report a clear as done when IndexedDB never answered it", async () => {
    vi.useFakeTimers();
    const dbName = `gg-stalled-clear-${crypto.randomUUID()}`;
    const storage = memoryStorage();
    storage.setItem("gg-commitment-proof-drafts", commitmentDraft);
    const source = clientWithGardens();
    setIndexedDB(undefined);
    await createQueryPersistence({ dbName, storage }).persistQuery(source, gardensKey);
    setIndexedDB(stalledIndexedDB());

    const cleared = expect(createQueryPersistence({ dbName, storage }).clear()).rejects.toThrow(
      /could not clear/
    );
    await vi.advanceTimersByTimeAsync(3_000);
    await cleared;

    // Web storage still loses its reading-cache copy; only IndexedDB's are left for the next launch.
    expect(storage.length).toBe(1);
    expect(storage.getItem("gg-commitment-proof-drafts")).toBe(commitmentDraft);
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

    await expect(launchAndRead({ dbName, storage })).resolves.toBeUndefined();
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
