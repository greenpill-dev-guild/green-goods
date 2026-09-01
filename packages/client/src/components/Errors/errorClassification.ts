export type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

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

/** Classifies boundary failures without treating offline chunk misses as stale deploys. */
export function classifyErrorMessage(
  rawMessage: string,
  isOnline = typeof navigator === "undefined" || navigator.onLine !== false
): ErrorCategory {
  const message = rawMessage.toLowerCase();
  if (CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return isOnline ? "chunk" : "offline";
  }
  if (LOOP_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return "loop";
  if (NETWORK_ERROR_MESSAGES.some((candidate) => message.includes(candidate))) return "network";
  if (OFFLINE_ERROR_MESSAGES.some((candidate) => message.includes(candidate))) return "offline";
  return "unknown";
}
