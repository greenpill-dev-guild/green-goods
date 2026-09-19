/**
 * Reading the whole-snapshot cache an earlier build wrote.
 *
 * One record held every query. This module owns finding it, handing it over
 * once, and forgetting it; `query-persistence.ts` owns the per-query store it
 * is migrated into.
 *
 * @module config/query-persistence-legacy
 */

import type { DehydratedState } from "@tanstack/react-query";
import { createStore, del as idbDel, get as idbGet } from "idb-keyval";
import { debugWarn } from "../utils/debug";

/** Key the previous build stored its whole-cache snapshot under. */
export const LEGACY_SNAPSHOT_KEY = "__rq_pc__";

/** Where a previous build kept its whole-cache snapshot. */
export interface LegacySnapshotSource {
  dbName: string;
  storeName: string;
}

export interface LegacySnapshotRecord {
  snapshot: unknown;
  /** Drop the snapshot and its database; called only once every record has moved. */
  forget: () => Promise<void>;
}

export function isLegacySnapshot(value: unknown): value is {
  timestamp: number;
  buster: string;
  clientState: DehydratedState;
} {
  const candidate = value as { timestamp?: unknown; buster?: unknown; clientState?: unknown };
  return (
    typeof candidate?.timestamp === "number" &&
    typeof candidate.buster === "string" &&
    Array.isArray((candidate.clientState as DehydratedState | undefined)?.queries)
  );
}

/**
 * Whether the legacy database still exists.
 *
 * idb-keyval's `createStore` opens with an upgrade handler, which *creates* the
 * database when it is absent. Asking for a snapshot that was migrated away
 * therefore resurrected an empty copy on every boot, which nothing then
 * cleaned up. Browsers without `databases()` fall through to the old behaviour.
 */
async function hasDatabase(name: string): Promise<boolean> {
  const list = (indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> })
    .databases;
  if (typeof list !== "function") return true;
  try {
    return (await list.call(indexedDB)).some((entry) => entry.name === name);
  } catch {
    return true;
  }
}

export async function readLegacySnapshot(
  legacy: LegacySnapshotSource | undefined,
  storage: Storage | undefined
): Promise<{ snapshot: unknown; forget: () => Promise<void> } | undefined> {
  if (
    legacy &&
    typeof indexedDB !== "undefined" &&
    indexedDB &&
    (await hasDatabase(legacy.dbName))
  ) {
    try {
      const store = createStore(legacy.dbName, legacy.storeName);
      const snapshot = await idbGet(LEGACY_SNAPSHOT_KEY, store);
      if (snapshot !== undefined) {
        return {
          snapshot,
          forget: async () => {
            await idbDel(LEGACY_SNAPSHOT_KEY, store).catch(() => undefined);
            await deleteDatabase(legacy.dbName);
          },
        };
      }
    } catch (error) {
      debugWarn("[Persister] Could not read the previous reading cache:", { error });
    }
  }
  if (storage) {
    try {
      const raw = storage.getItem(LEGACY_SNAPSHOT_KEY);
      if (raw) {
        return {
          snapshot: JSON.parse(raw),
          forget: async () => {
            storage.removeItem(LEGACY_SNAPSHOT_KEY);
          },
        };
      }
    } catch (error) {
      debugWarn("[Persister] Could not read the previous storage cache:", { error });
    }
  }
  return undefined;
}

export function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve();
  return new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
