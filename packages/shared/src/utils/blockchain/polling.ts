/**
 * Transaction Polling Utility
 *
 * Handles polling queries after blockchain transactions to account for indexer lag.
 * Base Sepolia block time: ~2 seconds
 * Envio indexer lag: typically 1-3 blocks behind (2-6 seconds)
 *
 * Strategy: Exponential backoff with max 3 attempts over ~14 seconds total
 *
 * @module utils/blockchain/polling
 */

import { queryClient } from "../../config/react-query";
import { debugLog } from "../debug";

interface PollConfig {
  /** Array of query keys to invalidate and refetch */
  queryKeys: readonly (readonly unknown[])[];
  /** Maximum number of polling attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 2000ms = 2s) */
  baseDelay?: number;
  /** Maximum delay between attempts (default: 8000ms = 8s) */
  maxDelay?: number;
  /** Optional callback fired after each attempt */
  onAttempt?: (attempt: number, delay: number) => void;
}

/**
 * Poll queries after a blockchain transaction to wait for indexer processing
 *
 * Uses exponential backoff to balance responsiveness with server load:
 * - Attempt 1: 2s delay (1 block)
 * - Attempt 2: 4s delay (2 blocks)
 * - Attempt 3: 8s delay (4 blocks)
 * Total wait: ~14 seconds
 *
 * @param config - Polling configuration
 * @returns Promise that resolves after all polling attempts complete
 *
 * @example
 * ```typescript
 * // After transaction confirmation
 * await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
 *
 * // Poll for indexer updates
 * await pollQueriesAfterTransaction({
 *   queryKeys: [
 *     queryKeys.works.online(gardenAddress, chainId),
 *     queryKeys.works.merged(gardenAddress, chainId),
 *   ],
 * });
 * ```
 */
export async function pollQueriesAfterTransaction(config: PollConfig): Promise<void> {
  const { queryKeys, maxAttempts = 3, baseDelay = 2000, maxDelay = 8000, onAttempt } = config;

  if (queryKeys.length === 0) {
    console.warn("[Polling] No query keys provided, skipping polling");
    return;
  }

  debugLog("[Polling] Starting post-transaction polling", {
    queryKeyCount: queryKeys.length,
    maxAttempts,
    baseDelay,
    maxDelay,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Calculate delay with exponential backoff
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Wait before polling (except first attempt can be immediate if baseDelay=0)
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

    debugLog(`[Polling] Attempt ${attempt + 1}/${maxAttempts} completed`, {
      delay,
      nextDelay:
        attempt < maxAttempts - 1 ? Math.min(baseDelay * Math.pow(2, attempt + 1), maxDelay) : null,
    });

    // Fire callback if provided
    onAttempt?.(attempt + 1, delay);
  }

  debugLog("[Polling] Post-transaction polling completed", {
    totalAttempts: maxAttempts,
    totalTime: Array.from({ length: maxAttempts }, (_, i) =>
      Math.min(baseDelay * Math.pow(2, i), maxDelay)
    ).reduce((sum, d) => sum + d, 0),
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
