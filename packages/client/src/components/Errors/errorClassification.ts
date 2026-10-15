import { isAppCodeLoadError } from "@green-goods/shared/modules/app/cache-recovery";

export type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

const CHUNK_RELOAD_SESSION_KEY = "gg-chunk-reload";

const LOOP_ERROR_PATTERNS = [
  /maximum update depth exceeded/i,
  /minified react error #301/i,
  /minified react error #310/i,
  /rendered more hooks than during the previous render/i,
  /rendered fewer hooks than expected/i,
];

const NETWORK_ERROR_MESSAGES = [
  "network error",
  "fetch failed",
  "failed to fetch",
  "network request failed",
];

const OFFLINE_ERROR_MESSAGES = ["offline", "job_queue", "sync", "indexeddb"];

export function isChunkLoadErrorMessage(rawMessage: string): boolean {
  return isAppCodeLoadError(rawMessage);
}

function getSessionStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function hasChunkReloadAttempt(): boolean {
  try {
    return getSessionStorage()?.getItem(CHUNK_RELOAD_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markChunkReloadAttempt(): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    storage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
    return storage.getItem(CHUNK_RELOAD_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Classifies boundary failures without treating offline chunk misses as stale deploys. */
export function classifyErrorMessage(
  rawMessage: string,
  isOnline = typeof navigator === "undefined" || navigator.onLine !== false
): ErrorCategory {
  const message = rawMessage.toLowerCase();
  if (isChunkLoadErrorMessage(message)) {
    return isOnline ? "chunk" : "offline";
  }
  if (LOOP_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return "loop";
  if (NETWORK_ERROR_MESSAGES.some((candidate) => message.includes(candidate))) return "network";
  if (OFFLINE_ERROR_MESSAGES.some((candidate) => message.includes(candidate))) return "offline";
  return "unknown";
}
