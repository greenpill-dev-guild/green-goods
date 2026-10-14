/**
 * Error Message Extraction Utility
 *
 * Provides a consistent way to extract error messages from various error types.
 * Used by parseContractError and the wallet-submission boundary modules to
 * preserve raw error text before downstream classification.
 *
 * @module utils/errors/extract-message
 */

/**
 * Extract a string message from any error type
 *
 * Handles:
 * - String errors (returned as-is)
 * - Error instances (returns .message)
 * - Objects with message property
 * - Any other value (stringified)
 *
 * @param error - Any error value
 * @returns String representation of the error message
 *
 * @example
 * ```typescript
 * extractErrorMessage("Simple error")              // "Simple error"
 * extractErrorMessage(new Error("Error instance")) // "Error instance"
 * extractErrorMessage({ message: "Object error" }) // "Object error"
 * extractErrorMessage({ code: 123 })               // "[object Object]"
 * extractErrorMessage(null)                        // "null"
 * ```
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }

  return String(error);
}

/**
 * Extract error message with optional fallback
 *
 * @param error - Any error value
 * @param fallback - Fallback message if extraction fails or results in empty string
 * @returns Extracted message or fallback
 *
 * @example
 * ```typescript
 * extractErrorMessageOr(null, "Unknown error")     // "Unknown error"
 * extractErrorMessageOr("", "Default message")     // "Default message"
 * extractErrorMessageOr(new Error("Msg"), "Def")   // "Msg"
 * ```
 */
export function extractErrorMessageOr(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error);
  return message.trim() || fallback;
}

/**
 * A viem request error quotes the request inside its message: a `URL:` line and a
 * `Request body:` line. Each runs to the next line feed. Other line separators can sit inside
 * the quoted body, so the match stops at a line feed only.
 */
const QUOTED_REQUEST_LINE = /(^|\n)(?:URL|Request body): [^\n]*/g;

/**
 * What an error message says went wrong, without the request it quotes.
 *
 * The quoted request carries whatever the person typed, an account name for one, and the
 * address that was called. Use this wherever keywords in a message decide what a person is told
 * or how a failure is counted, so that neither can pick the answer.
 *
 * @example
 * ```typescript
 * withoutQuotedRequest("Refused.\nURL: https://example\nRequest body: {…}\nDetails: Taken")
 * // "Refused.\n\n\nDetails: Taken"
 * ```
 */
export function withoutQuotedRequest(message: string): string {
  return message.replace(QUOTED_REQUEST_LINE, "$1");
}
