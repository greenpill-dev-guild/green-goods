/**
 * Query invalidation scheduling utilities.
 *
 * These live alongside query key ownership because they exist to stage
 * delayed invalidation against the canonical shared query key contract.
 */

import type { QueryClient } from "@tanstack/react-query";

export const INVALIDATION_DELAYS = {
  SHORT: 3_000,
  MEDIUM: 5_000,
  LONG: 10_000,
} as const;

export type InvalidationDelay = (typeof INVALIDATION_DELAYS)[keyof typeof INVALIDATION_DELAYS];

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

export function scheduleInvalidationForKey(
  queryClient: QueryClient,
  key: readonly unknown[],
  delayMs: number = INVALIDATION_DELAYS.SHORT
): () => void {
  return scheduleInvalidation(queryClient, [key], delayMs);
}

export interface ProgressiveInvalidationOptions {
  initialDelay?: number;
  maxRetries?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

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
