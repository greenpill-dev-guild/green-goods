/**
 * Blockchain Error Detection Utility
 *
 * Maps raw error strings from blockchain interactions to categorized error types.
 * Used for displaying user-friendly error messages during transaction flows.
 */

export type BlockchainErrorType =
  | "userRejected"
  | "insufficientFunds"
  | "network"
  | "gasEstimation"
  | "nonce"
  | "timeout"
  | "unknown";

export interface BlockchainErrorInfo {
  type: BlockchainErrorType;
  /** i18n key prefix for this error type */
  i18nKeyPrefix: string;
  /** Whether this error is potentially recoverable by retry */
  recoverable: boolean;
  /** Suggested user action */
  suggestedAction: "retry" | "addFunds" | "waitAndRetry" | "contact" | "none";
}

/**
 * Error detection patterns and their metadata.
 * Patterns are matched case-insensitively against the error message.
 */
const ERROR_PATTERNS: Array<{
  patterns: string[];
  info: BlockchainErrorInfo;
}> = [
  {
    patterns: [
      "user rejected",
      "user denied",
      "rejected by user",
      "user cancelled",
      "user canceled",
      "rejected the request",
      "user declined",
    ],
    info: {
      type: "userRejected",
      i18nKeyPrefix: "app.errors.blockchain.userRejected",
      recoverable: true,
      suggestedAction: "retry",
    },
  },
  {
    patterns: [
      "insufficient funds",
      "insufficient balance",
      "not enough",
      "exceeds balance",
      "insufficient eth",
      "balance too low",
    ],
    info: {
      type: "insufficientFunds",
      i18nKeyPrefix: "app.errors.blockchain.insufficientFunds",
      recoverable: false,
      suggestedAction: "addFunds",
    },
  },
  {
    patterns: [
      "network",
      "connection",
      "failed to fetch",
      "disconnected",
      "rpc",
      "could not connect",
      "econnrefused",
    ],
    info: {
      type: "network",
      i18nKeyPrefix: "app.errors.blockchain.network",
      recoverable: true,
      suggestedAction: "waitAndRetry",
    },
  },
  {
    patterns: ["timeout", "timed out", "request timeout"],
    info: {
      type: "timeout",
      i18nKeyPrefix: "app.errors.blockchain.timeout",
      recoverable: true,
      suggestedAction: "retry",
    },
  },
  {
    patterns: [
      "out of gas",
      "gas required exceeds",
      "intrinsic gas too low",
      "execution reverted",
      "gas estimation failed",
      "exceeds block gas limit",
    ],
    info: {
      type: "gasEstimation",
      i18nKeyPrefix: "app.errors.blockchain.gasEstimation",
      recoverable: true,
      suggestedAction: "retry",
    },
  },
  {
    patterns: [
      "nonce too low",
      "nonce too high",
      "replacement transaction underpriced",
      "transaction with the same nonce",
      "nonce already used",
      "nonce has already been used",
    ],
    info: {
      type: "nonce",
      i18nKeyPrefix: "app.errors.blockchain.nonce",
      recoverable: true,
      suggestedAction: "waitAndRetry",
    },
  },
];

const UNKNOWN_ERROR_INFO: BlockchainErrorInfo = {
  type: "unknown",
  i18nKeyPrefix: "app.errors.blockchain.unknown",
  recoverable: true,
  suggestedAction: "retry",
};

/**
 * Detects the type of blockchain error from an error message.
 *
 * @param error - The error message, Error object, or any value that can be stringified
 * @returns BlockchainErrorInfo with type, i18n key prefix, and recovery info
 *
 * @example
 * ```ts
 * const info = detectBlockchainError("User rejected the request");
 * // Returns: { type: "userRejected", i18nKeyPrefix: "app.errors.blockchain.userRejected", ... }
 *
 * const key = getBlockchainErrorI18nKey(error, "title");
 * // Returns: "app.errors.blockchain.userRejected.title"
 * ```
 */
export function detectBlockchainError(
  error: string | Error | null | undefined
): BlockchainErrorInfo {
  if (!error) return UNKNOWN_ERROR_INFO;

  const errorStr = typeof error === "string" ? error : (error.message ?? String(error));
  const lowerError = errorStr.toLowerCase();

  for (const { patterns, info } of ERROR_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerError.includes(pattern)) {
        return info;
      }
    }
  }

  return UNKNOWN_ERROR_INFO;
}

/**
 * Gets the i18n key for a blockchain error with a specific suffix.
 *
 * @param error - The error to classify
 * @param suffix - The i18n key suffix (e.g., "title", "message", "action")
 * @returns The complete i18n key
 *
 * @example
 * ```ts
 * getBlockchainErrorI18nKey("user rejected", "title")
 * // Returns: "app.errors.blockchain.userRejected.title"
 * ```
 */
export function getBlockchainErrorI18nKey(
  error: string | Error | null | undefined,
  suffix: string = "message"
): string {
  const info = detectBlockchainError(error);
  return `${info.i18nKeyPrefix}.${suffix}`;
}

/**
 * Checks if a blockchain error is potentially recoverable by retrying.
 */
export function isRecoverableBlockchainError(error: string | Error | null | undefined): boolean {
  return detectBlockchainError(error).recoverable;
}

/**
 * Gets the suggested action for a blockchain error.
 */
export function getBlockchainErrorAction(
  error: string | Error | null | undefined
): BlockchainErrorInfo["suggestedAction"] {
  return detectBlockchainError(error).suggestedAction;
}
