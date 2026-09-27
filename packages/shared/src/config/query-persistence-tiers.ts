/**
 * The storage the reading cache can keep its records in: IndexedDB, web
 * storage and memory, each behind the same small store interface.
 *
 * This module owns how each medium reads and writes one record;
 * `query-persistence-stores.ts` owns which one is used, when to move on, and
 * keeping them consistent.
 *
 * @module config/query-persistence-tiers
 */

import type { PersistedQuery as StoredQuery } from "@tanstack/query-persist-client-core";
import {
  createStore,
  clear as idbClear,
  del as idbDel,
  entries as idbEntries,
  get as idbGet,
  promisifyRequest,
} from "idb-keyval";
import { debugWarn } from "../utils/debug";

export interface QueryStore {
  /** Whether this tier survives a page restart. */
  isDurable(): boolean;
  get(key: string): Promise<StoredQuery | undefined>;
  /** `isStale` is asked again when a write that waited on the tier finally runs. */
  set(key: string, value: StoredQuery, isStale?: () => boolean): Promise<void>;
  remove(key: string): Promise<void>;
  entries(): Promise<Array<[string, StoredQuery]>>;
  clear(): Promise<void>;
}

export function createIdbQueryStore(dbName: string, storeName: string): QueryStore | undefined {
  if (typeof indexedDB === "undefined" || !indexedDB) return undefined;
  try {
    const store = createStore(dbName, storeName);
    return {
      isDurable: () => true,
      get: (key) => idbGet<StoredQuery>(key, store),
      // A stalled open runs every write queued on it once it succeeds, which
      // can be long after the store moved on; a stale one then stays out.
      set: (key, value, isStale) =>
        store("readwrite", (objectStore) => {
          if (isStale?.()) return;
          objectStore.put(value, key);
          return promisifyRequest(objectStore.transaction);
        }),
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

export function createWebQueryStore(storage: Storage, prefix: string): QueryStore {
  // Other features keep their own `gg-` keys in this storage, drafts among
  // them. A record's key is the prefix and its query hash, and a query hash is
  // a serialized array, so only those keys are ever read, moved or cleared.
  const recordPrefix = `${prefix}-[`;
  const recordKeys = () => {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(recordPrefix)) keys.push(key);
    }
    return keys;
  };
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
    entries: async () =>
      recordKeys().flatMap((key): Array<[string, StoredQuery]> => {
        const value = parse(storage.getItem(key));
        return value ? [[key, value]] : [];
      }),
    clear: async () => {
      for (const key of recordKeys()) storage.removeItem(key);
    },
  };
}

export function createMemoryQueryStore(): QueryStore {
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
