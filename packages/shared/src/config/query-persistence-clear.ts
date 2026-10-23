import { debugWarn } from "../utils/debug";
import { QUERY_CACHE_STORAGE_PREFIX } from "./query-cache-policy";
import {
  deleteDatabase,
  LEGACY_SNAPSHOT_KEY,
  type LegacySnapshotSource,
} from "./query-persistence-legacy";
import { createWebQueryStore } from "./query-persistence-tiers";

/** Cache recovery stays usable without loading the query client or workspace.
 * Drafts, settings and authentication metadata are kept. Best effort, never throws. */
export async function clearPersistedQueryClient(options: {
  dbName: string;
  legacy?: LegacySnapshotSource;
}): Promise<void> {
  await deleteDatabase(options.dbName);
  if (options.legacy) await deleteDatabase(options.legacy.dbName);
  try {
    const storage = typeof window === "undefined" ? undefined : window.localStorage;
    if (!storage) return;
    storage.removeItem(LEGACY_SNAPSHOT_KEY);
    await createWebQueryStore(storage, QUERY_CACHE_STORAGE_PREFIX).clear();
  } catch (error) {
    debugWarn("[Persister] Failed to clear the storage cache:", { error });
  }
}
