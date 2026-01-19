/**
 * User-Friendly Error Messages
 *
 * Centralizes error message mapping for common error patterns.
 * Used by work-submission, wallet-submission, and other modules
 * to provide consistent, user-friendly error messages.
 *
 * @module utils/errors/user-messages
 */

import { extractErrorMessage } from "./extract-message";

/**
 * Error patterns mapped to user-friendly messages
 * Keys are lowercase patterns to match against error messages
 */
export const USER_FRIENDLY_ERRORS: Record<string, string> = {
  // Access control errors
  gardener: "You don't have permission to submit work to this garden",
  permission: "Permission denied - check your garden access",
  unauthorized: "You're not authorized to perform this action",
  "not a gardener": "You're not a member of this garden. Please join from your profile.",
  notgardener: "You're not a member of this garden. Please join from your profile.",
  "not a member": "You're not a member of this garden. Please join from your profile.",
  notgardenmember: "You're not a member of this garden. Please join from your profile.",

  // Network and connectivity errors
  network: "Network connection error - your work is saved offline",
  "network error": "Network error - please check your connection",
  offline: "You're offline - your work will sync when you reconnect",
  timeout: "Request timed out - please try again",

  // Transaction errors
  "user rejected": "Transaction cancelled by user",
  "insufficient funds": "Insufficient funds for gas",
  nonce: "Transaction conflict - please try again",
  reverted: "Transaction would fail. Make sure you're a member of the selected garden.",

  // Storage errors
  quota: "Storage quota exceeded - please free up space",
  storage: "Storage error - please try again",

  // Validation errors
  invalid: "Invalid data - please check your submission",
  "validation failed": "Please check your submission and try again",

  // General errors
  failed: "Operation failed - please try again",
};

/**
 * Format an error into a user-friendly message
 *
 * Checks the error message against known patterns and returns
 * a friendly message if found, otherwise returns the original message.
 *
 * @param error - Error object, string, or unknown
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * try {
 *   await submitWork();
 * } catch (error) {
 *   const message = formatUserError(error);
 *   toast.error({ title: "Submission Failed", message });
 * }
 * ```
 */
export function formatUserError(error: string | Error | unknown): string {
  const message = extractErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  // Check each pattern for a match
  for (const [pattern, friendlyMessage] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (lowerMessage.includes(pattern)) {
      return friendlyMessage;
    }
  }

  // Return original message if no pattern matches
  return message;
}

/**
 * Format job queue errors for display
 *
 * More specific error formatting for job queue operations.
 *
 * @param error - Error message string
 * @returns Formatted error message
 */
export function formatJobError(error: string): string {
  return formatUserError(error);
}

/**
 * Get wallet-specific error messages
 *
 * Provides more specific messages for common wallet errors.
 *
 * @param error - Error object from wallet transaction
 * @returns User-friendly error message
 */
export function formatWalletError(error: unknown): string {
  const message = extractErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  // Wallet-specific patterns
  if (lowerMessage.includes("user rejected") || lowerMessage.includes("user denied")) {
    return "Transaction cancelled by user";
  }
  if (lowerMessage.includes("insufficient funds")) {
    return "Insufficient funds for gas";
  }
  if (lowerMessage.includes("nonce")) {
    return "Transaction conflict - please try again";
  }
  if (lowerMessage.includes("network")) {
    return "Network error - please check your connection";
  }
  if (lowerMessage.includes("timeout")) {
    return "Transaction timed out - please try again";
  }
  if (lowerMessage.includes("reverted") && !message.includes("reason")) {
    return "Transaction would fail. Make sure you're a member of the selected garden.";
  }

  // Fall back to generic formatting
  return formatUserError(error);
}
