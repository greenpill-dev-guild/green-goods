/**
 * Mutation Lock Hook
 *
 * Provides a synchronous ref-based guard to prevent double-submit
 * in mutation hooks. Unlike React state (which batches updates),
 * refs update synchronously — the second rapid call sees the lock
 * immediately and short-circuits before any async work begins.
 *
 * @module hooks/utils/useMutationLock
 */

import { useCallback, useRef, useState } from "react";

/**
 * Hook that returns helpers to deduplicate async mutation invocations.
 *
 * The lock ensures only one invocation runs at a time. A second call
 * while the first is in-flight reuses the in-flight promise.
 *
 * @returns Object with `guard`, `runWithLock`, `isLocked`, and `isPending`
 *
 * @example
 * ```tsx
 * const { runWithLock } = useMutationLock();
 *
 * const mutateAsync = (params: Params) =>
 *   runWithLock(() => submitTransaction(params));
 * ```
 */
export function useMutationLock() {
  const isSubmittingRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<unknown> | null>(null);
  const [isPending, setIsPending] = useState(false);

  const runWithLock = useCallback(<TResult>(fn: () => Promise<TResult>): Promise<TResult> => {
    if (isSubmittingRef.current && inFlightPromiseRef.current) {
      return inFlightPromiseRef.current as Promise<TResult>;
    }

    isSubmittingRef.current = true;
    setIsPending(true);

    const promise = fn().finally(() => {
      isSubmittingRef.current = false;
      inFlightPromiseRef.current = null;
      setIsPending(false);
    });

    inFlightPromiseRef.current = promise as Promise<unknown>;
    return promise;
  }, []);

  const guard = useCallback(
    <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) => {
      return async (...args: TArgs): Promise<TResult> => {
        return runWithLock(() => fn(...args));
      };
    },
    [runWithLock]
  );

  const isLocked = useCallback(() => isSubmittingRef.current, []);

  return { guard, runWithLock, isLocked, isPending };
}
