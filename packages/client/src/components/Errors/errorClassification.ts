const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /chunkloaderror/i,
  /loading chunk\s+\S+\s+failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

const LOOP_ERROR_PATTERNS: RegExp[] = [
  /maximum update depth exceeded/i,
  /minified react error #301/i,
  /minified react error #310/i,
  /rendered more hooks than during the previous render/i,
  /rendered fewer hooks than expected/i,
];

export type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

export function classifyErrorMessage(message: string): ErrorCategory {
  const normalizedMessage = message.toLowerCase();
  if (CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
    // Offline chunk failures cannot recover through a reload because the new
    // asset is still unreachable. Keep the user in the offline experience.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    return "chunk";
  }
  if (LOOP_ERROR_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) return "loop";
  if (
    ["network error", "fetch failed", "failed to fetch", "network request failed"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return "network";
  }
  if (
    ["offline", "job_queue", "sync", "indexeddb"].some((term) => normalizedMessage.includes(term))
  ) {
    return "offline";
  }
  return "unknown";
}
