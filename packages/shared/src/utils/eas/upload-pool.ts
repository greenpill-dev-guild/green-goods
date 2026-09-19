/**
 * Determines upload concurrency based on connection quality.
 * Uses Network Information API when available, falls back to full concurrency.
 */
export function getUploadConcurrency(fileCount: number): number {
  if (typeof navigator === "undefined") return fileCount;
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  if (!conn?.effectiveType) return fileCount;
  switch (conn.effectiveType) {
    case "slow-2g":
    case "2g":
      return 1;
    case "3g":
      return 2;
    default:
      return fileCount;
  }
}

/**
 * Runs async tasks with a concurrency limit, returning PromiseSettledResult[].
 * Maintains original array order regardless of completion order.
 */
export async function pooledSettled<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  if (concurrency >= tasks.length) {
    return Promise.allSettled(tasks.map((fn) => fn()));
  }

  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}
