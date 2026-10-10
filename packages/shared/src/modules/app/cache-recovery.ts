import { logger } from "./logger";
import { OBSOLETE_RUNTIME_CACHES as RETIRED_CACHE_NAMES } from "./service-worker-protocol";

const OBSOLETE_RUNTIME_CACHES = new Set<string>(RETIRED_CACHE_NAMES);

/** Preserve the offline shell, query reads, share inbox, drafts and queued jobs. */
export async function clearObsoleteRuntimeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => OBSOLETE_RUNTIME_CACHES.has(key)).map((key) => caches.delete(key))
    );
  } catch (error) {
    logger.warn("[ServiceWorker] Failed to clear retired caches", { error });
  }
}
