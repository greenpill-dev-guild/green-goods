/**
 * Where the reading cache keeps its records, and how it falls back.
 *
 * IndexedDB is preferred, web storage is the fallback, and memory holds reads
 * for the session when neither can be reached. This module owns those tiers
 * and the deadline on every storage operation; `query-persistence.ts` owns
 * what is written and restored.
 *
 * @module config/query-persistence-stores
 */

import type { PersistedQuery as StoredQuery } from "@tanstack/query-persist-client-core";
import {
  createStore,
  clear as idbClear,
  del as idbDel,
  entries as idbEntries,
  get as idbGet,
  set as idbSet,
} from "idb-keyval";
import { debugWarn } from "../utils/debug";

/**
 * How long one reading-cache operation may run before its storage tier counts
 * as unusable. IndexedDB can stall without ever failing: an open queued behind
 * a blocked delete, or a wedged origin, fires no success, error or blocked
 * event. Every query reads the cache before it fetches, so without a deadline
 * one stalled open holds the whole app on its loading state. Matches the job
 * queue's database open timeout.
 */
const STORE_OPERATION_TIMEOUT_MS = 3_000;

export interface QueryStore {
  /** Whether this tier survives a page restart. */
  isDurable(): boolean;
  get(key: string): Promise<StoredQuery | undefined>;
  set(key: string, value: StoredQuery): Promise<void>;
  remove(key: string): Promise<void>;
  entries(): Promise<Array<[string, StoredQuery]>>;
  clear(): Promise<void>;
}

function createIdbQueryStore(dbName: string, storeName: string): QueryStore | undefined {
  if (typeof indexedDB === "undefined" || !indexedDB) return undefined;
  try {
    const store = createStore(dbName, storeName);
    return {
      isDurable: () => true,
      get: (key) => idbGet<StoredQuery>(key, store),
      set: (key, value) => idbSet(key, value, store),
      remove: (key) => idbDel(key, store),
      entries: async () =>
        (await idbEntries<string, StoredQuery>(store)).filter(
          ([key, value]) => typeof key === "string" && value !== undefined
        ),
      clear: () => idbClear(store),
    };
  } catch (error) {
    debugWarn("[Persister] IndexedDB is unavailable, falling back to web storage:", { error });
    return undefined;
  }
}

function createWebQueryStore(storage: Storage, prefix: string): QueryStore {
  const keyPrefix = `${prefix}-`;
  const parse = (raw: string | null): StoredQuery | undefined => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as StoredQuery;
    } catch {
      return undefined;
    }
  };
  return {
    isDurable: () => true,
    get: async (key) => parse(storage.getItem(key)),
    set: async (key, value) => {
      storage.setItem(key, JSON.stringify(value));
    },
    remove: async (key) => {
      storage.removeItem(key);
    },
    entries: async () => {
      const found: Array<[string, StoredQuery]> = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(keyPrefix)) continue;
        const value = parse(storage.getItem(key));
        if (value) found.push([key, value]);
      }
      return found;
    },
    clear: async () => {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith(keyPrefix)) storage.removeItem(key);
      }
    },
  };
}

function createMemoryQueryStore(): QueryStore {
  const memory = new Map<string, StoredQuery>();
  return {
    isDurable: () => false,
    get: async (key) => memory.get(key),
    set: async (key, value) => {
      memory.set(key, value);
    },
    remove: async (key) => {
      memory.delete(key);
    },
    entries: async () => [...memory.entries()],
    clear: async () => memory.clear(),
  };
}

/** Settle with the operation, or reject once it has run past the deadline. */
function withDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Reading cache storage did not answer within ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([operation, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Use the next storage tier when the current one refuses an operation or
 * never answers it.
 *
 * IndexedDB opens lazily, so merely constructing its store does not prove it
 * is usable. Safari private mode and storage policy failures can arrive from
 * the first asynchronous operation instead, and a stalled open may never
 * settle at all. Demoting for the rest of this session makes the documented
 * IDB -> web storage -> memory chain real.
 *
 * A tier failing is not itself a persistence error: a read that falls back, or
 * a write that web storage keeps, lost nothing. `onLostWrite` hears only about
 * writes that no durable tier kept, which is what the installed app reports as
 * offline storage being full.
 */
function createFailoverQueryStore(
  stores: QueryStore[],
  onLostWrite: (error: unknown) => void
): QueryStore {
  let active = 0;
  const run = async <T>(operation: (store: QueryStore) => Promise<T>): Promise<T> => {
    const tier = active;
    try {
      return await withDeadline(operation(stores[tier]), STORE_OPERATION_TIMEOUT_MS);
    } catch (error) {
      debugWarn("[Persister] Reading cache tier failed; using the next one", { error });
      // Boot starts many reads at once, and a stalled tier fails them together.
      // Only the first failure demotes it; the rest retry wherever it now points,
      // so a burst cannot skip a tier that still works.
      if (tier === active) {
        if (tier >= stores.length - 1) throw error;
        active = tier + 1;
      }
      return run(operation);
    }
  };
  const write = async (operation: (store: QueryStore) => Promise<void>): Promise<void> => {
    try {
      await run(operation);
    } catch (error) {
      onLostWrite(error);
      throw error;
    }
    if (!stores[active].isDurable()) {
      onLostWrite(new Error("Reading cache is keeping this write in memory only"));
    }
  };
  return {
    isDurable: () => stores[active].isDurable(),
    get: (key) => run((store) => store.get(key)),
    set: (key, value) => write((store) => store.set(key, value)),
    remove: (key) => run((store) => store.remove(key)),
    entries: () => run((store) => store.entries()),
    clear: () => run((store) => store.clear()),
  };
}

/**
 * The reading cache's tiers behind one store: IndexedDB, then web storage when
 * the browser allows it, then memory for the rest of the session. Never throws.
 */
export function createReadingCacheStore(options: {
  dbName: string;
  storeName: string;
  webStorage: Storage | undefined;
  prefix: string;
  onLostWrite: (error: unknown) => void;
}): QueryStore {
  const { dbName, storeName, webStorage, prefix, onLostWrite } = options;
  try {
    const stores = [
      createIdbQueryStore(dbName, storeName),
      webStorage ? createWebQueryStore(webStorage, prefix) : undefined,
      createMemoryQueryStore(),
    ].filter((candidate): candidate is QueryStore => candidate !== undefined);
    return createFailoverQueryStore(stores, onLostWrite);
  } catch (error) {
    debugWarn("[Persister] Query persistence is disabled for this session:", { error });
    return createMemoryQueryStore();
  }
}
