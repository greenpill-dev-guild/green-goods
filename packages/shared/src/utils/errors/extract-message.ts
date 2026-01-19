/**
 * Error Message Extraction Utility
 *
 * Provides a consistent way to extract error messages from various error types.
 * Consolidates error message extraction logic that was duplicated across
 * contract-errors.ts and user-messages.ts.
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
