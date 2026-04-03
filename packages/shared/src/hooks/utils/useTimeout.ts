/**
 * Timeout Hook
 *
 * Provides a safe wrapper around setTimeout with automatic cleanup.
 * Prevents memory leaks by clearing timeouts on unmount.
 *
 * @module hooks/utils/useTimeout
 */

import { useCallback, useEffect, useRef } from "react";

interface UseTimeoutReturn {
  /** Schedule a timeout. Returns a function to cancel it. */
  set: (callback: () => void, delay: number) => () => void;
  /** Clear the current timeout if any */
  clear: () => void;
  /** Whether a timeout is currently scheduled */
  isPending: () => boolean;
}

/**
 * Hook for managing timeouts with automatic cleanup.
 *
 * @returns Object with set, clear, and isPending functions
 *
 * @example
 * ```tsx
 * function Component() {
 *   const { set, clear } = useTimeout();
 *
 *   const handleSuccess = () => {
 *     // Schedule query invalidation after delay
 *     set(() => {
 *       queryClient.invalidateQueries({ queryKey: ["data"] });
 *     }, 3000);
 *   };
 *
 *   // Timeout is automatically cleared on unmount
 *   return <button onClick={handleSuccess}>Submit</button>;
 * }
 * ```
 */
export function useTimeout(): UseTimeoutReturn {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Clear timeout on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const set = useCallback(
    (callback: () => void, delay: number) => {
      // Clear any existing timeout
      clear();

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        // Only execute if still mounted
        if (isMountedRef.current) {
          timeoutRef.current = null;
          callback();
        }
      }, delay);

      // Return cancel function
      return clear;
    },
    [clear]
  );

  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  return { set, clear, isPending };
}

interface UseDelayedInvalidationReturn {
  /** Schedule the invalidation to run after the delay */
  start: () => void;
  /** Cancel a pending invalidation */
  cancel: () => void;
  /** Returns true if an invalidation is currently pending */
  isPending: () => boolean;
}

/**
 * Hook for delayed query invalidation with automatic cleanup.
 * Common pattern for giving indexers time to process blockchain events.
 *
 * @param invalidate - The invalidation function to call
 * @param delay - Delay in milliseconds (default: 5000)
 * @returns Object with start and cancel functions
 *
 * @example
 * ```tsx
 * const { start: scheduleInvalidation, cancel } = useDelayedInvalidation(
 *   () => queryClient.invalidateQueries({ queryKey: ["gardens"] }),
 *   10000 // 10 seconds for indexer
 * );
 *
 * // In mutation success handler
 * onSuccess: () => {
 *   scheduleInvalidation();
 * }
 *
 * // Cancel if needed
 * onCancel: () => {
 *   cancel();
 * }
 * ```
 */
export function useDelayedInvalidation(
  invalidate: () => void,
  delay: number = 5000
): UseDelayedInvalidationReturn {
  const { set, clear, isPending } = useTimeout();

  // Store latest invalidate in a ref to avoid recreating callback when invalidate changes
  const latestInvalidateRef = useRef(invalidate);

  // Keep ref updated with latest invalidate function
  useEffect(() => {
    latestInvalidateRef.current = invalidate;
  }, [invalidate]);

  const start = useCallback(() => {
    set(() => latestInvalidateRef.current(), delay);
  }, [set, delay]);

  return { start, cancel: clear, isPending };
}

interface UseProgressiveInvalidationReturn {
  /** Schedule progressive invalidations at each delay in the schedule */
  start: () => void;
  /** Cancel all pending invalidations */
  cancel: () => void;
}

/**
 * Hook for progressive query invalidation with automatic cleanup.
 * Fires the invalidation function at multiple intervals to handle
 * variable indexer lag (e.g. 2s, 5s, 15s).
 *
 * @param invalidate - The invalidation function to call at each interval
 * @param schedule - Array of delays in milliseconds
 * @returns Object with start and cancel functions
 *
 * @example
 * ```tsx
 * import { INDEXER_LAG_SCHEDULE_MS } from "../query-keys";
 *
 * const { start: scheduleFollowUp } = useProgressiveInvalidation(
 *   () => queryClient.invalidateQueries({ queryKey: ["gardens"] }),
 *   INDEXER_LAG_SCHEDULE_MS
 * );
 *
 * onSuccess: () => {
 *   scheduleFollowUp();
 * }
 * ```
 */
export function useProgressiveInvalidation(
  invalidate: () => void,
  schedule: readonly number[]
): UseProgressiveInvalidationReturn {
  const isMountedRef = useRef(true);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latestInvalidateRef = useRef(invalidate);

  useEffect(() => {
    latestInvalidateRef.current = invalidate;
  }, [invalidate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      for (const id of timeoutIdsRef.current) {
        clearTimeout(id);
      }
      timeoutIdsRef.current = [];
    };
  }, []);

  const cancel = useCallback(() => {
    for (const id of timeoutIdsRef.current) {
      clearTimeout(id);
    }
    timeoutIdsRef.current = [];
  }, []);

  const start = useCallback(() => {
    // Clear any previously scheduled progressive invalidations
    cancel();
    timeoutIdsRef.current = schedule.map((delay) =>
      setTimeout(() => {
        if (isMountedRef.current) {
          latestInvalidateRef.current();
        }
      }, delay)
    );
  }, [cancel, schedule]);

  return { start, cancel };
}
