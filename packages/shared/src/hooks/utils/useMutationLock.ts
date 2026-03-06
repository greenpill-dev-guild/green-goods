/**
 * Mutation Lock Hook
 *
 * Provides a synchronous ref-based guard to prevent double-submit
 * in mutation hooks. Unlike React state (which batches updates),
 * refs update synchronously — the second rapid call sees the lock
 * immediately and short-circuits before any async work begins.
 *
 * Supports optional shared locks via `key` parameter — all hook instances
 * using the same key share the same lock state (e.g., single and batch
 * approval hooks should not run concurrently).
 *
 * @module hooks/utils/useMutationLock
 */

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

// Module-level shared lock registry for key-based locks
const sharedLocks = new Map<string, { isSubmitting: boolean; promise: Promise<unknown> | null }>();
const sharedLockListeners = new Map<string, Set<() => void>>();

function getSharedLock(key: string) {
  let lock = sharedLocks.get(key);
  if (!lock) {
    lock = { isSubmitting: false, promise: null };
    sharedLocks.set(key, lock);
  }
  return lock;
}

function notifySharedLockListeners(key: string) {
  const listeners = sharedLockListeners.get(key);
  if (listeners) {
    listeners.forEach((listener) => listener());
  }
}

function subscribeSharedLock(key: string, listener: () => void) {
  let listeners = sharedLockListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    sharedLockListeners.set(key, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      sharedLockListeners.delete(key);
    }
  };
}

/**
 * Hook that returns helpers to deduplicate async mutation invocations.
 *
 * The lock ensures only one invocation runs at a time. A second call
 * while the first is in-flight reuses the in-flight promise.
 *
 * @param key - Optional shared lock key. Hooks using the same key share one lock.
 * @returns Object with `guard`, `runWithLock`, `isLocked`, and `isPending`
 *
 * @example
 * ```tsx
 * // Per-instance lock (default)
 * const { runWithLock } = useMutationLock();
 *
 * // Shared lock across hooks
 * const { runWithLock } = useMutationLock("approval");
 * ```
 */
export function useMutationLock(key?: string) {
  // Per-instance refs (used when no key is provided)
  const isSubmittingRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<unknown> | null>(null);
  const [localIsPending, setLocalIsPending] = useState(false);

  // Shared lock state (used when key is provided)
  const sharedIsPending = useSyncExternalStore(
    key ? (listener) => subscribeSharedLock(key, listener) : () => () => {},
    key ? () => getSharedLock(key).isSubmitting : () => false
  );

  const runWithLock = useCallback(
    <TResult>(fn: () => Promise<TResult>): Promise<TResult> => {
      if (key) {
        // Shared lock path
        const lock = getSharedLock(key);
        if (lock.isSubmitting && lock.promise) {
          return lock.promise as Promise<TResult>;
        }

        lock.isSubmitting = true;
        notifySharedLockListeners(key);

        const promise = fn().finally(() => {
          lock.isSubmitting = false;
          lock.promise = null;
          notifySharedLockListeners(key);
        });

        lock.promise = promise as Promise<unknown>;
        return promise;
      }

      // Per-instance lock path (original behavior)
      if (isSubmittingRef.current && inFlightPromiseRef.current) {
        return inFlightPromiseRef.current as Promise<TResult>;
      }

      isSubmittingRef.current = true;
      setLocalIsPending(true);

      const promise = fn().finally(() => {
        isSubmittingRef.current = false;
        inFlightPromiseRef.current = null;
        setLocalIsPending(false);
      });

      inFlightPromiseRef.current = promise as Promise<unknown>;
      return promise;
    },
    [key]
  );

  const guard = useCallback(
    <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) => {
      return async (...args: TArgs): Promise<TResult> => {
        return runWithLock(() => fn(...args));
      };
    },
    [runWithLock]
  );

  const isLocked = useCallback(() => {
    if (key) return getSharedLock(key).isSubmitting;
    return isSubmittingRef.current;
  }, [key]);

  const isPending = key ? sharedIsPending : localIsPending;

  return { guard, runWithLock, isLocked, isPending };
}
