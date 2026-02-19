/**
 * Transaction Polling Utility
 *
 * Handles polling queries after blockchain transactions to account for indexer lag.
 * Sepolia block time: ~12 seconds
 * Envio indexer lag: typically 1-3 blocks behind
 *
 * Strategy: Smart polling with early exit when data changes
 * - Faster initial delays (1s, 2s, 4s) for responsiveness
 * - Early exit when cache data changes (new items detected)
 * - Configurable max time for timeout scenarios
 *
 * @module utils/blockchain/polling
 */

import { queryClient } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { debugLog } from "../debug";

/**
 * Shared timeout for waiting on on-chain transaction receipts.
 */
export const TX_RECEIPT_TIMEOUT_MS = 120_000;

interface PollConfig {
  /** Array of query keys to invalidate and refetch */
  queryKeys: readonly (readonly unknown[])[];
  /** Maximum number of polling attempts (default: 4) */
  maxAttempts?: number;
  /** Initial delay before first attempt in ms (default: 0 for immediate check) */
  initialDelayMs?: number;
  /** Base delay for exponential backoff in ms (default: 500ms) */
  baseDelay?: number;
  /** Maximum delay between attempts (default: 4000ms = 4s) */
  maxDelay?: number;
  /** Optional callback fired after each attempt */
  onAttempt?: (attempt: number, delay: number) => void;
  /** Optional callback when data changes (for early exit detection) */
  onDataChange?: () => void;
}

/**
 * Get the current count of items for a query key
 */
function getQueryDataCount(queryKey: readonly unknown[]): number {
  const data = queryClient.getQueryData<unknown[]>(queryKey);
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Poll queries after a blockchain transaction to wait for indexer processing
 *
 * Uses smart polling with early exit:
 * - Attempt 1: 1s delay (fast initial check)
 * - Attempt 2: 2s delay
 * - Attempt 3: 4s delay
 * - Attempt 4: 4s delay (max)
 * Total max wait: ~11 seconds
 *
 * Early exit: Polling stops when the data count increases (new item detected)
 *
 * @param config - Polling configuration
 * @returns Promise that resolves after data changes or max attempts reached
 *
 * @example
 * ```typescript
 * // After transaction confirmation
 * await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
 *
 * // Poll for indexer updates with smart early exit
 * await pollQueriesAfterTransaction({
 *   queryKeys: [
 *     queryKeys.works.online(gardenAddress, chainId),
 *     queryKeys.works.merged(gardenAddress, chainId),
 *   ],
 *   baseDelay: 1000,
 *   maxDelay: 4000,
 * });
 * ```
 */
export async function pollQueriesAfterTransaction(config: PollConfig): Promise<void> {
  const {
    queryKeys,
    maxAttempts = 4,
    initialDelayMs = 0, // Immediate first check by default
    baseDelay = 500, // Faster base delay for responsiveness
    maxDelay = 4000,
    onAttempt,
    onDataChange,
  } = config;

  if (queryKeys.length === 0) {
    logger.warn("[Polling] No query keys provided, skipping polling");
    return;
  }

  // Capture initial data counts for early exit detection
  const initialCounts = queryKeys.map((key) => getQueryDataCount(key));

  debugLog("[Polling] Starting smart post-transaction polling", {
    queryKeyCount: queryKeys.length,
    maxAttempts,
    initialDelayMs,
    baseDelay,
    maxDelay,
    initialCounts,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // First attempt uses initialDelayMs, subsequent use exponential backoff
    const delay =
      attempt === 0 ? initialDelayMs : Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Wait before polling (skip if delay is 0)
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Invalidate and refetch all queries
    await Promise.all(
      queryKeys.map((key) =>
        queryClient.invalidateQueries({
          queryKey: key,
          refetchType: "active",
        })
      )
    );

    // Check for early exit: did data count increase?
    const currentCounts = queryKeys.map((key) => getQueryDataCount(key));
    const dataChanged = currentCounts.some((count, i) => count > initialCounts[i]);

    debugLog(`[Polling] Attempt ${attempt + 1}/${maxAttempts} completed`, {
      delay,
      initialCounts,
      currentCounts,
      dataChanged,
      nextDelay:
        attempt < maxAttempts - 1 ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay) : null,
    });

    // Fire callback if provided
    onAttempt?.(attempt + 1, delay);

    // Early exit if data changed
    if (dataChanged) {
      debugLog("[Polling] Early exit: new data detected", {
        totalAttempts: attempt + 1,
        totalTime: delay + (attempt > 0 ? baseDelay * (Math.pow(2, attempt) - 1) : 0),
      });
      onDataChange?.();
      return;
    }
  }

  debugLog("[Polling] Post-transaction polling completed (max attempts reached)", {
    totalAttempts: maxAttempts,
  });
}

/**
 * Simplified polling for single query key
 *
 * @param queryKey - Single query key to poll
 * @param options - Optional polling configuration
 *
 * @example
 * ```typescript
 * await pollQueryAfterTransaction(
 *   queryKeys.works.online(gardenAddress, chainId),
 *   { maxAttempts: 2 }
 * );
 * ```
 */
export async function pollQueryAfterTransaction(
  queryKey: unknown[],
  options?: Omit<PollConfig, "queryKeys">
): Promise<void> {
  return pollQueriesAfterTransaction({
    ...options,
    queryKeys: [queryKey],
  });
}
