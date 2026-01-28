/**
 * Error Categorization Utility
 *
 * Provides a consistent way to categorize errors by type and extract
 * useful metadata for logging and user feedback.
 *
 * @module utils/errors/categorize-error
 */

import { extractErrorMessage } from "./extract-message";

/**
 * Categories for error classification
 */
export type ErrorCategory =
  | "network"
  | "validation"
  | "auth"
  | "permission"
  | "blockchain"
  | "storage"
  | "unknown";

/**
 * Result of error categorization
 */
export interface CategorizedError {
  /** Human-readable error message */
  message: string;
  /** Error category for handling/routing */
  category: ErrorCategory;
  /** Optional metadata for logging */
  metadata?: Record<string, unknown>;
}

/**
 * Known error message patterns and their categories
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  // Network errors
  { pattern: /\b(network|fetch|timeout|connection|disconnected|offline)\b/i, category: "network" },
  { pattern: /failed to fetch|net::ERR/i, category: "network" },

  // Auth errors
  { pattern: /unauthorized|unauthenticated|not authenticated/i, category: "auth" },
  { pattern: /session expired|login required|wallet not connected/i, category: "auth" },

  // Permission errors
  { pattern: /forbidden|not allowed|permission denied|access denied/i, category: "permission" },
  { pattern: /not a gardener|not a member|not authorized/i, category: "permission" },

  // Blockchain errors (wallet rejection moved here for consistency with blockchain-errors.ts)
  { pattern: /user rejected|user denied|user cancelled/i, category: "blockchain" },
  { pattern: /insufficient funds|insufficient balance|exceeds balance/i, category: "blockchain" },
  { pattern: /out of gas|execution reverted|transaction failed/i, category: "blockchain" },
  { pattern: /nonce too low|nonce too high|replacement transaction/i, category: "blockchain" },
  // More specific hex pattern: 40 chars (address) or 64 chars (hash)
  { pattern: /\b0x[a-fA-F0-9]{40}\b|\b0x[a-fA-F0-9]{64}\b/i, category: "blockchain" },
  // More specific blockchain patterns - "contract" alone is too generic
  {
    pattern:
      /\brevert\b|smart contract|\bcontract (address|creation|call|failed)|\bcontract 0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b/i,
    category: "blockchain",
  },

  // Storage errors
  { pattern: /\b(quota|storage|indexeddb|localStorage)\b/i, category: "storage" },
  { pattern: /ipfs|storacha|upload failed|\bcid\b/i, category: "storage" },
  { pattern: /not initialized.*initializeIpfs/i, category: "storage" },

  // Validation errors - more specific patterns to reduce false positives
  {
    pattern: /\b(validation|required field|invalid (format|date|email|input|value|parameter))\b/i,
    category: "validation",
  },
  { pattern: /\bmissing (parameter|field|property|argument|value)\b/i, category: "validation" },
];

/**
 * Categorize an error based on its message and type.
 *
 * Analyzes the error to determine its category (network, auth, blockchain, etc.)
 * and extracts a clean message suitable for logging or user display.
 *
 * @param error - Any error value
 * @returns Categorized error with message, category, and optional metadata
 *
 * @example
 * ```typescript
 * try {
 *   await mintHypercert();
 * } catch (error) {
 *   const categorized = categorizeError(error);
 *   logger.error("Mint failed", {
 *     message: categorized.message,
 *     category: categorized.category,
 *   });
 *
 *   if (categorized.category === "network") {
 *     toast.error("Network error. Please check your connection.");
 *   }
 * }
 * ```
 */
export function categorizeError(error: unknown): CategorizedError {
  const message = extractErrorMessage(error);
  const metadata: Record<string, unknown> = {};

  // Extract additional metadata from Error objects
  if (error instanceof Error) {
    metadata.name = error.name;
    if (error.cause) {
      metadata.cause = String(error.cause);
    }
  }

  // Try to match against known patterns
  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        message,
        category,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }
  }

  // Default to unknown category
  return {
    message: message || "An unexpected error occurred",
    category: "unknown",
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
