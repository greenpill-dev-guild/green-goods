/**
 * How the reading cache falls back across its storage tiers.
 *
 * IndexedDB is preferred, web storage is the fallback, and memory holds reads
 * for the session when neither can be reached. This module owns the deadline
 * on every storage operation, which tier answers, and putting the tiers back
 * in order after a session had to leave IndexedDB. `query-persistence-tiers.ts`
 * owns each medium, and `query-persistence.ts` what is written and restored.
 *
 * @module config/query-persistence-stores
 */

import type { PersistedQuery as StoredQuery } from "@tanstack/query-persist-client-core";
import { debugWarn } from "../utils/debug";
import {
  createIdbQueryStore,
  createMemoryQueryStore,
  createWebQueryStore,
  type QueryStore,
} from "./query-persistence-tiers";

/**
 * How long one reading-cache operation may run before its storage tier counts
 * as unusable. IndexedDB can stall without ever failing: an open queued behind
 * a blocked delete, or a wedged origin, fires no success, error or blocked
 * event. Every query reads the cache before it fetches, so without a deadline
 * one stalled open holds the whole app on its loading state. Matches the job
 * queue's database open timeout.
 */
const STORE_OPERATION_TIMEOUT_MS = 3_000;

/** Every tier behind one store. */
export interface ReadingCacheStore extends QueryStore {
  /** Fold newer answers a lower tier kept into the preferred tier. Never throws. */
  reconcile(isRestorable: (record: StoredQuery) => boolean): Promise<void>;
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
export const answeredAt = (record: StoredQuery | undefined) =>
  Number(record?.state?.dataUpdatedAt) || 0;

/** Where a mutation ended up: a durable tier, memory only, or nowhere because a newer one won. */
type Kept = "durable" | "memory" | "superseded";

/** The newer of a late answer and the active tier's; a tie keeps the active one. */
const newerAnswer = (late: StoredQuery | undefined, current: StoredQuery | undefined) =>
  answeredAt(late) > answeredAt(current) ? late : current;

/** Every key either listing holds, each with its newer answer. */
function newerEntries(late: Array<[string, StoredQuery]>, current: Array<[string, StoredQuery]>) {
  const merged = new Map(current);
  for (const [key, record] of late) merged.set(key, newerAnswer(record, merged.get(key)) ?? record);
  return [...merged];
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
 * A deadline cannot cancel what it abandons: once the stall clears, IndexedDB
 * still runs every operation that was waiting on it, so the store never
 * assumes the tiers agree. A read a demoted tier answers late keeps the newer
 * of its answer and the active tier's. A mutation that lands there replays on
 * the active tier, and one that is stale by then stands down. `reconcile`
 * sorts out the copies at boot.
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
  /** Keys a lower tier still holds a copy of until `reconcile` reaches them. */
  const unreconciled = new Map<string, QueryStore>();

  const run = async <T>(
    operation: (tier: QueryStore) => Promise<T>,
    keepNewer?: (late: T, current: T) => T
  ): Promise<T> => {
    const tier = active;
    let answer: T;
    try {
      answer = await withDeadline(operation(tiers[tier]), STORE_OPERATION_TIMEOUT_MS);
    } catch (error) {
      debugWarn("[Persister] Reading cache tier failed; using the next one", { error });
      // Boot starts many reads at once, and a stalled tier fails them together.
      // Only the first failure demotes it; the rest retry wherever it now points,
      // so a burst cannot skip a tier that still works.
      if (tier === active) {
        if (tier >= tiers.length - 1) throw error;
        active = tier + 1;
      }
      return run(operation, keepNewer);
    }
    if (!keepNewer || tier === active) return answer;
    // Another operation demoted this tier while it answered, and the active
    // tier may hold answers written since. Dropping the late answer instead
    // would lose the only copy of a read the active tier never had.
    return keepNewer(answer, await run(operation, keepNewer));
  };

  /**
   * Record a mutation of `key` as its newest, returning whether it still is.
   * Entries stay after the mutation settles, so a write IndexedDB runs late
   * can still tell whether something newer replaced it.
   */
  const claim = (key: string) => {
    const mine = Symbol(key);
    newestMutation.set(key, mine);
    return () => newestMutation.get(key) === mine;
  };

  /**
   * Run a claimed mutation. A retry starts only after the failed tier's
   * deadline, by which time a newer mutation of the same key may have landed
   * on the next tier; the older one then stands down rather than write over
   * it. One that landed on a tier another operation demoted meanwhile replays
   * on the active tier, which is the one this session reads. An attempt the
   * deadline abandoned may still run later, and is stale by then if a newer
   * mutation started or a durable tier kept this one.
   */
  const runMutation = (
    isNewest: () => boolean,
    operation: (tier: QueryStore, isStale: () => boolean) => Promise<void>
  ) => {
    let attempt = 0;
    let keptDurably = false;
    const isStale = () => keptDurably || !isNewest();
    return run(
      async (tier): Promise<Kept> => {
        if (attempt++ > 0 && !isNewest()) return keptDurably ? "durable" : "superseded";
        await operation(tier, isStale);
        if (tier.isDurable()) keptDurably = true;
        return keptDurably ? "durable" : "memory";
      },
      (_demoted, replayed) => replayed
    );
  };

  /**
   * A session that left IndexedDB wrote to web storage only. Boot prefers
   * IndexedDB again, so without this it would restore IndexedDB's older
   * copies and never read the newer ones. The newest answer per key wins and
   * a tie keeps the preferred copy. A record this build would not restore,
   * such as one an older build wrote under another schema, replaces nothing.
   * A lower copy is dropped once the preferred tier holds an answer at least
   * as new, unless something rewrote it after it was listed.
   */
  const reconcile = async (isRestorable: (record: StoredQuery) => boolean) => {
    try {
      for (const lower of tiers.slice(1).filter((tier) => tier.isDurable())) {
        const listed = await lower.entries();
        for (const [key] of listed) unreconciled.set(key, lower);
        for (const [key, record] of listed) {
          if (active !== 0) return;
          if (isRestorable(record)) {
            // Only watched while reading: claiming now would make a write
            // already in flight stand down even if nothing replaces it.
            const newestBefore = newestMutation.get(key);
            const held = await run((tier) => tier.get(key));
            const untouched = newestMutation.get(key) === newestBefore;
            if (active === 0 && untouched && answeredAt(record) > answeredAt(held)) {
              await runMutation(claim(key), (tier, isStale) => tier.set(key, record, isStale));
            }
          }
          // Another tab still on web storage may have rewritten the key since
          // it was listed; that newer copy waits for the next reconcile.
          const current = await lower.get(key);
          // Checked with no await before the removal: once IndexedDB is
          // demoted, the lower copy is what this session reads and writes.
          if (active !== 0) return;
          if (answeredAt(current) <= answeredAt(record)) await lower.remove(key);
          unreconciled.delete(key);
        }
      }
    } catch (error) {
      debugWarn("[Persister] Could not reconcile the reading cache tiers", { error });
    } finally {
      unreconciled.clear();
    }
  };

  return {
    isDurable: () => tiers[active].isDurable(),
    get: async (key) => {
      const answer = await run((tier) => tier.get(key), newerAnswer);
      // Boot stops waiting for the restore after its timeout, and until
      // reconcile reaches a key its newer answer may still be in a lower tier.
      const lower = active === 0 ? unreconciled.get(key) : undefined;
      return lower ? newerAnswer(await lower.get(key).catch(() => undefined), answer) : answer;
    },
    set: async (key, value) => {
      let kept: Kept;
      try {
        kept = await runMutation(claim(key), (tier, isStale) => tier.set(key, value, isStale));
      } catch (error) {
        onLostWrite(error);
        throw error;
      }
      if (kept === "memory") {
        onLostWrite(new Error("Reading cache is keeping this write in memory only"));
      }
    },
    remove: async (key) => {
      await runMutation(claim(key), (tier) => tier.remove(key));
    },
    entries: () => run((tier) => tier.entries(), newerEntries),
    clear: async () => {
      let preferredCleared = false;
      await run(async (tier) => {
        await tier.clear();
        if (tier === tiers[0]) preferredCleared = true;
      });
      // Every lower tier is cleared too, including one the clear fell back to:
      // a copy left in any of them would come back at the next reconcile.
      for (const lower of tiers.slice(1)) {
        await lower.clear().catch((error: unknown) => {
          debugWarn("[Persister] Could not clear a lower reading cache tier", { error });
        });
      }
      // The preferred tier keeps what a clear it never answered should have
      // removed, and the next launch restores from it, so this is not done.
      if (!preferredCleared)
        throw new Error("Reading cache could not clear its preferred storage tier");
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
