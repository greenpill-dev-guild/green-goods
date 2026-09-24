/**
 * Where the reading cache keeps its records, and how it falls back.
 *
 * IndexedDB is preferred, web storage is the fallback, and memory holds reads
 * for the session when neither can be reached. This module owns those tiers,
 * the deadline on every storage operation, and putting the tiers back in
 * order after a session had to leave IndexedDB; `query-persistence.ts` owns
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

interface QueryStore {
  /** Whether this tier survives a page restart. */
  isDurable(): boolean;
  get(key: string): Promise<StoredQuery | undefined>;
  set(key: string, value: StoredQuery): Promise<void>;
  remove(key: string): Promise<void>;
  entries(): Promise<Array<[string, StoredQuery]>>;
  clear(): Promise<void>;
}

/** Every tier behind one store. */
export interface ReadingCacheStore extends QueryStore {
  /** Fold the newer answers a lower tier kept back into the preferred tier. Never throws. */
  reconcile(): Promise<void>;
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

/** When a stored answer was fetched; a record without that time counts as oldest. */
const answeredAt = (record: StoredQuery | undefined) => Number(record?.state?.dataUpdatedAt) || 0;

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
 * A deadline cannot cancel what it abandons: once the stall clears, IndexedDB
 * still runs every operation that was waiting on it. The store therefore
 * never assumes the tiers agree. A retried mutation stands down for a newer
 * one of the same key, and `reconcile` sorts out the copies at the next boot.
 *
 * A tier failing is not itself a persistence error: a read that falls back, or
 * a write that web storage keeps, lost nothing. `onLostWrite` hears only about
 * writes that no durable tier kept, which is what the installed app reports as
 * offline storage being full.
 */
function createFailoverQueryStore(
  tiers: QueryStore[],
  onLostWrite: (error: unknown) => void
): ReadingCacheStore {
  let active = 0;
  const newestMutation = new Map<string, symbol>();

  const run = async <T>(operation: (tier: QueryStore) => Promise<T>): Promise<T> => {
    const tier = active;
    try {
      return await withDeadline(operation(tiers[tier]), STORE_OPERATION_TIMEOUT_MS);
    } catch (error) {
      debugWarn("[Persister] Reading cache tier failed; using the next one", { error });
      // Boot starts many reads at once, and a stalled tier fails them together.
      // Only the first failure demotes it; the rest retry wherever it now points,
      // so a burst cannot skip a tier that still works.
      if (tier === active) {
        if (tier >= tiers.length - 1) throw error;
        active = tier + 1;
      }
      return run(operation);
    }
  };

  /** Record a mutation of `key` as its newest; every older one is then stale. */
  const claim = (key: string) => {
    const mine = Symbol(key);
    newestMutation.set(key, mine);
    return {
      isNewest: () => newestMutation.get(key) === mine,
      release: () => {
        if (newestMutation.get(key) === mine) newestMutation.delete(key);
      },
    };
  };

  /**
   * Run a claimed mutation, resolving with whether it landed. A retry starts
   * only after the failed tier's deadline, by which time a newer mutation of
   * the same key may have landed on the next tier; the older one then stands
   * down rather than write its answer over the newer one.
   */
  const runMutation = (
    claimed: ReturnType<typeof claim>,
    operation: (tier: QueryStore) => Promise<void>
  ) => {
    let attempt = 0;
    return run(async (tier) => {
      if (attempt++ > 0 && !claimed.isNewest()) return false;
      await operation(tier);
      return true;
    });
  };

  const mutate = async (key: string, operation: (tier: QueryStore) => Promise<void>) => {
    const claimed = claim(key);
    try {
      return await runMutation(claimed, operation);
    } finally {
      claimed.release();
    }
  };

  /**
   * A session that left IndexedDB wrote to web storage only, and a write it
   * abandoned there can land later with an older answer. Boot prefers
   * IndexedDB again, so without this it would restore the older copies and
   * never read the newer ones. The newest answer per key wins, a tie keeps
   * the preferred copy, and a lower copy is dropped only once the preferred
   * tier holds an answer at least as new.
   */
  const reconcile = async () => {
    try {
      for (const lower of tiers.slice(1).filter((tier) => tier.isDurable())) {
        for (const [key, record] of await lower.entries()) {
          if (active !== 0) return;
          const claimed = claim(key);
          try {
            const held = await run((tier) => tier.get(key));
            if (active === 0 && claimed.isNewest() && answeredAt(record) > answeredAt(held)) {
              await runMutation(claimed, (tier) => tier.set(key, record));
            }
            // Checked with no await before the removal: once IndexedDB is
            // demoted, the lower copy is what this session reads and writes.
            if (active !== 0) return;
            await lower.remove(key);
          } finally {
            claimed.release();
          }
        }
      }
    } catch (error) {
      debugWarn("[Persister] Could not reconcile the reading cache tiers", { error });
    }
  };

  return {
    isDurable: () => tiers[active].isDurable(),
    get: (key) => run((tier) => tier.get(key)),
    set: async (key, value) => {
      let landed: boolean;
      try {
        landed = await mutate(key, (tier) => tier.set(key, value));
      } catch (error) {
        onLostWrite(error);
        throw error;
      }
      if (landed && !tiers[active].isDurable()) {
        onLostWrite(new Error("Reading cache is keeping this write in memory only"));
      }
    },
    remove: async (key) => {
      await mutate(key, (tier) => tier.remove(key));
    },
    entries: () => run((tier) => tier.entries()),
    clear: async () => {
      await run((tier) => tier.clear());
      // A copy left in a lower tier would come back at the next reconcile.
      for (const lower of tiers.slice(active + 1)) {
        await lower.clear().catch((error: unknown) => {
          debugWarn("[Persister] Could not clear a lower reading cache tier", { error });
        });
      }
      // The preferred tier keeps what a clear it never answered should have
      // removed, and the next launch restores from it, so this is not done.
      if (active !== 0) throw new Error("Reading cache could not clear its preferred storage tier");
    },
    reconcile,
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
}): ReadingCacheStore {
  const { dbName, storeName, webStorage, prefix, onLostWrite } = options;
  try {
    const tiers = [
      createIdbQueryStore(dbName, storeName),
      webStorage ? createWebQueryStore(webStorage, prefix) : undefined,
      createMemoryQueryStore(),
    ].filter((tier): tier is QueryStore => tier !== undefined);
    return createFailoverQueryStore(tiers, onLostWrite);
  } catch (error) {
    debugWarn("[Persister] Query persistence is disabled for this session:", { error });
    return createFailoverQueryStore([createMemoryQueryStore()], () => undefined);
  }
}
