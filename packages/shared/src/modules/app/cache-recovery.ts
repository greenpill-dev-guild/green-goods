import { logger } from "./logger";

const OBSOLETE_RUNTIME_CACHES = new Set(["js-cache", "indexer-cache", "graphql-cache"]);

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
