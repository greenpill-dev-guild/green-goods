import { logger } from "./logger";
import { OBSOLETE_RUNTIME_CACHES as RETIRED_CACHE_NAMES } from "./service-worker-protocol";
import type { UpdateCheckResult } from "./service-worker-update";

const OBSOLETE_RUNTIME_CACHES = new Set<string>(RETIRED_CACHE_NAMES);

const CODE_LOAD_ERRORS = [
  /chunkloaderror/i,
  /loading chunk\s+\S+\s+failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

/** Import rejections are retained by the document, even after the connection returns. */
export function isAppCodeLoadError(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let current = error; current && !seen.has(current); ) {
    seen.add(current);
    const message =
      typeof current === "string"
        ? current
        : typeof current === "object" && "message" in current
          ? String(current.message)
          : "";
    if (CODE_LOAD_ERRORS.some((pattern) => pattern.test(message))) return true;
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return false;
}

let recoveryRequest = 0;
const codeListeners = new Set<() => void>();

/** Page-local recovery only: restarting clears it without touching any saved work. */
export const appCodeRecovery = {
  getSnapshot: () => recoveryRequest,
  subscribe: (listener: () => void) => {
    codeListeners.add(listener);
    return () => {
      codeListeners.delete(listener);
    };
  },
  report: (error: unknown): boolean => {
    if (!isAppCodeLoadError(error)) return false;
    if (recoveryRequest === 0) logger.warn("[AppCode] Code could not load; a restart is required");
    recoveryRequest += 1;
    for (const listener of codeListeners) listener();
    return true;
  },
  /** The browser also remembers a transient import failure on the current build. */
  restartIfSafe: (isBlocked: () => boolean, reloadGuard: { current: boolean }): void => {
    if (
      !appCodeRecovery.getSnapshot() ||
      navigator.onLine === false ||
      isBlocked() ||
      reloadGuard.current
    )
      return;
    reloadGuard.current = true;
    logger.info("[AppCode] Restarting after a code-load failure");
    window.location.reload();
  },
  /** Check before choosing worker activation or a guarded restart of the same build. */
  checkAndRestart: async (
    check: () => Promise<UpdateCheckResult>,
    activate: () => void,
    isBlocked: () => boolean,
    reloadGuard: { current: boolean }
  ): Promise<void> => {
    const result = await check();
    if (!appCodeRecovery.getSnapshot() || isBlocked()) return;
    if (result === "ready") activate();
    else if (result === "up-to-date") appCodeRecovery.restartIfSafe(isBlocked, reloadGuard);
  },
};

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
