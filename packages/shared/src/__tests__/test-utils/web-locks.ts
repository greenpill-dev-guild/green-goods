import { vi } from "vitest";

/** The Web Lock a queued send holds from just before its intent until its answer. */
export const sendLockName = (jobId: string) => `green-goods:queue-send:${jobId}`;

/**
 * A stand-in for the origin's Web Locks. `held` is every tab's locks at once: a
 * tab the OS froze keeps its locks and a closed one gives them up.
 */
function fakeLockManager(held: Set<string>) {
  return {
    request: async (
      name: string,
      options: { ifAvailable?: boolean },
      granted: (lock: { name: string } | null) => Promise<unknown>
    ) => {
      if (options.ifAvailable && held.has(name)) return granted(null);
      held.add(name);
      try {
        return await granted({ name });
      } finally {
        held.delete(name);
      }
    },
    query: async () => ({ held: [...held].map((name) => ({ name })) }),
  };
}

/**
 * Stands in for the origin's Web Locks, since a test worker's own may be
 * missing. Replaces the whole navigator; undo with `vi.unstubAllGlobals()`.
 */
export function stubWebLocks(held: Set<string>): void {
  vi.stubGlobal("navigator", { locks: fakeLockManager(held) });
}

/**
 * Adds stand-in Web Locks to a DOM test's own navigator, which keeps its other
 * properties, until the returned function takes them away.
 */
export function addWebLocks(held: Set<string> = new Set()): () => void {
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: fakeLockManager(held),
  });
  return () => {
    Reflect.deleteProperty(globalThis.navigator, "locks");
  };
}
