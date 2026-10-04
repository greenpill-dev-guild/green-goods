import { useCallback } from "react";
import type { Query } from "@tanstack/react-query";

// A removed Query is a removed auth session. Remounts share a Query; logout does not.
const pendingByQuery = new WeakMap<Query, Promise<void>>();

export function useGardenJoinRequestMutationBarrier() {
  const beginRequestMutation = useCallback((requestQuery: Query) => {
    const previousBarrier = pendingByQuery.get(requestQuery);
    let release!: () => void;
    const ownBarrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const combinedBarrier = previousBarrier
      ? Promise.all([previousBarrier, ownBarrier]).then(() => undefined)
      : ownBarrier;
    pendingByQuery.set(requestQuery, combinedBarrier);
    return () => {
      release();
      void combinedBarrier.then(() => {
        if (pendingByQuery.get(requestQuery) === combinedBarrier)
          pendingByQuery.delete(requestQuery);
      });
    };
  }, []);

  const waitForRequestMutation = useCallback(async (requestQuery: Query) => {
    const pending = pendingByQuery.get(requestQuery);
    if (pending) await pending;
  }, []);

  return { beginRequestMutation, waitForRequestMutation };
}
