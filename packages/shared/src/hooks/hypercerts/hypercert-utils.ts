/**
 * Hypercert Utility Functions
 *
 * Helper functions for hypercert minting operations including
 * timeout handling, ID extraction, and merkle tree serialization.
 *
 * @module hooks/hypercerts/hypercert-utils
 */

import { decodeEventLog, type Address, type Hex, zeroAddress } from "viem";

import { generateMerkleTree } from "../../lib/hypercerts";
import { ERC1155_TRANSFER_SINGLE_ABI } from "./hypercert-abis";

/** Maximum time (ms) to wait for transaction receipt before timing out */
export const RECEIPT_POLLING_TIMEOUT_MS = 120_000 as const; // 2 minutes

/** i18n key for timeout errors - consumers should resolve this key via localization */
const TIMEOUT_ERROR_KEY = "app.errors.timeout.transactionConfirmation";

/**
 * Custom error class for timeout operations.
 * Consumers can check `instanceof TimeoutError` or access `i18nKey`/`operation` properties.
 */
export class TimeoutError extends Error {
  readonly name = "TimeoutError" as const;
  readonly i18nKey = TIMEOUT_ERROR_KEY;
  readonly operation: string;

  constructor(operation: string) {
    super(`Operation timed out: ${operation}`);
    this.operation = operation;
  }
}

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the specified duration.
 * Supports optional AbortSignal for external cancellation.
 *
 * Note: Error contains an i18n key that should be resolved by consumers.
 *
 * @param promise - Promise to wrap with timeout
 * @param ms - Timeout duration in milliseconds
 * @param operation - Operation name for error messages
 * @param signal - Optional AbortSignal for external cancellation
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string,
  signal?: AbortSignal
): Promise<T> {
  // Check if already aborted before starting
  if (signal?.aborted) {
    return Promise.reject(new DOMException(`${operation} aborted`, "AbortError"));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const cleanup = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  };

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(operation)), ms);

    // Listen for external abort signal
    if (signal) {
      abortHandler = () => reject(new DOMException(`${operation} aborted`, "AbortError"));
      signal.addEventListener("abort", abortHandler);
    }
  });

  return Promise.race([promise, timeoutPromise]).finally(cleanup);
}

/**
 * Checks if an address is the zero address or undefined/null.
 */
export function isZeroAddress(address?: Address | null): boolean {
  return !address || address.toLowerCase() === zeroAddress;
}

/**
 * Extracts the hypercert ID from transaction logs.
 * Looks for ERC1155 TransferSingle events where from is the zero address (mint).
 *
 * @param logs - Transaction logs to search
 * @param chainId - Chain ID for constructing the full hypercert ID
 * @returns Hypercert ID string (chainId-tokenId) or null if not found
 */
export function extractHypercertIdFromLogs(
  logs: Array<{ address: Address } & Record<string, unknown>>,
  chainId: number
): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC1155_TRANSFER_SINGLE_ABI,
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });

      if (decoded.eventName !== "TransferSingle") continue;

      const args = decoded.args as {
        from: Address;
        id: bigint;
      };

      if (args.from.toLowerCase() === zeroAddress) {
        return `${chainId}-${args.id.toString()}`;
      }
    } catch {
      // Ignore non-matching logs
    }
  }
  return null;
}

/**
 * Serializes a merkle tree for upload to IPFS.
 */
export function serializeAllowlistTree(
  tree: ReturnType<typeof generateMerkleTree>["tree"]
): ReturnType<typeof tree.dump> {
  return tree.dump();
}
