import type Dexie from "dexie";

const OPEN_TIMEOUT_MS = 3_000;

/** Open a Dexie database without letting a stale tab leave callers pending forever. */
export async function openDexieDatabase(db: Dexie, errorPrefix: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abandoned = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${errorPrefix}-open-timeout`)), OPEN_TIMEOUT_MS);
    db.on("blocked", () => reject(new Error(`${errorPrefix}-upgrade-blocked`)));
  });
  try {
    await Promise.race([db.open(), abandoned]);
  } catch (error) {
    db.close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** A later subscription can retry after the blocking tab or browser state changes. */
export function isTerminalDatabaseOpenError(error: unknown, errorPrefix: string): boolean {
  return (
    error instanceof Error &&
    [`${errorPrefix}-open-timeout`, `${errorPrefix}-upgrade-blocked`].includes(error.message)
  );
}
