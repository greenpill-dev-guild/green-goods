export type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

export const CHUNK_RELOAD_SESSION_KEY = "gg-chunk-reload";

const CHUNK_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /loading chunk\s+\S+\s+failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

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
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage));
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

export function markChunkReloadAttempt(): void {
  try {
    getSessionStorage()?.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
  } catch {
    // Recovery remains best-effort when session storage is unavailable.
  }
}

export function clearChunkReloadAttempt(): void {
  try {
    getSessionStorage()?.removeItem(CHUNK_RELOAD_SESSION_KEY);
  } catch {
    // Recovery remains best-effort when session storage is unavailable.
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
