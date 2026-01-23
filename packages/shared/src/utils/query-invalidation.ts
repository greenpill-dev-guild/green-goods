/**
 * Query Invalidation Utilities
 *
 * Provides utilities for scheduled/delayed query invalidation,
 * commonly needed when waiting for indexers to process blockchain events.
 *
 * @module utils/query-invalidation
 */

import type { QueryClient } from "@tanstack/react-query";

/** Standard delay times for indexer syncing */
export const INVALIDATION_DELAYS = {
  /** Quick delay for fast indexers (e.g., local dev) */
  SHORT: 3_000,
  /** Medium delay for typical blockchain indexers */
  MEDIUM: 5_000,
  /** Long delay for slower indexers or high-latency chains */
  LONG: 10_000,
} as const;

export type InvalidationDelay = (typeof INVALIDATION_DELAYS)[keyof typeof INVALIDATION_DELAYS];

/**
 * Schedule query invalidation after a delay.
 *
 * Useful when blockchain transactions need time to be indexed before
 * the data is available in the API.
 *
 * @param queryClient - React Query client instance
 * @param keys - Array of query keys to invalidate
 * @param delayMs - Delay in milliseconds (default: 3000)
 * @returns Cleanup function to cancel the scheduled invalidation
 *
 * @example
 * ```typescript
 * // After submitting a transaction
 * const cleanup = scheduleInvalidation(
 *   queryClient,
 *   [queryKeys.works.all, queryKeys.gardens.all],
 *   INVALIDATION_DELAYS.MEDIUM
 * );
 *
 * // Optionally cancel if component unmounts
 * useEffect(() => cleanup, []);
 * ```
 */
export function scheduleInvalidation(
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[],
  delayMs: number = INVALIDATION_DELAYS.SHORT
): () => void {
  const timeoutId = setTimeout(() => {
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, delayMs);

  return () => clearTimeout(timeoutId);
}

/**
 * Schedule query invalidation for a single key.
 *
 * @param queryClient - React Query client instance
 * @param key - Query key to invalidate
 * @param delayMs - Delay in milliseconds (default: 3000)
 * @returns Cleanup function to cancel the scheduled invalidation
 */
export function scheduleInvalidationForKey(
  queryClient: QueryClient,
  key: readonly unknown[],
  delayMs: number = INVALIDATION_DELAYS.SHORT
): () => void {
  return scheduleInvalidation(queryClient, [key], delayMs);
}

/**
 * Options for progressive invalidation.
 */
export interface ProgressiveInvalidationOptions {
  /** Initial delay before first invalidation */
  initialDelay?: number;
  /** Maximum number of retry invalidations */
  maxRetries?: number;
  /** Multiplier for exponential backoff between retries */
  backoffMultiplier?: number;
  /** Maximum delay between invalidations */
  maxDelay?: number;
}

/**
 * Schedule progressive query invalidation with exponential backoff.
 *
 * Useful when you're not sure how long the indexer will take and want
 * to retry a few times with increasing delays.
 *
 * @param queryClient - React Query client instance
 * @param keys - Array of query keys to invalidate
 * @param options - Progressive invalidation options
 * @returns Cleanup function to cancel all scheduled invalidations
 *
 * @example
 * ```typescript
 * // Invalidate at 3s, 6s, 12s, 24s
 * const cleanup = scheduleProgressiveInvalidation(
 *   queryClient,
 *   [queryKeys.works.approvals()],
 *   { maxRetries: 3, backoffMultiplier: 2 }
 * );
 * ```
 */
export function scheduleProgressiveInvalidation(
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[],
  options: ProgressiveInvalidationOptions = {}
): () => void {
  const {
    initialDelay = INVALIDATION_DELAYS.SHORT,
    maxRetries = 2,
    backoffMultiplier = 2,
    maxDelay = INVALIDATION_DELAYS.LONG * 2,
  } = options;

  const timeoutIds: ReturnType<typeof setTimeout>[] = [];
  let currentDelay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    const delay = Math.min(currentDelay, maxDelay);
    const timeoutId = setTimeout(() => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }, delay);

    timeoutIds.push(timeoutId);
    currentDelay *= backoffMultiplier;
  }

  return () => {
    for (const id of timeoutIds) {
      clearTimeout(id);
    }
  };
}
