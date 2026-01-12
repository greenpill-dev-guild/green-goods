/**
 * Contract Error Parsing Utilities
 *
 * Parses contract revert errors from UserOperation failures and transaction errors.
 * Provides human-readable messages for common Green Goods contract errors.
 *
 * @module utils/errors/contract-errors
 */

import { extractErrorMessage } from "./extract-message";

/**
 * Error metadata with recovery information
 */
interface ErrorInfo {
  name: string;
  message: string;
  action?: string;
  recoverable: boolean;
  suggestedAction?: "retry" | "join-garden" | "contact-support" | "check-wallet";
}

/**
 * Common contract error signatures and their human-readable messages
 */
const ERROR_SIGNATURES: Record<string, ErrorInfo> = {
  // WorkResolver errors - membership check
  // Old selector (NotGardenerAccount) kept for backward compatibility with unupgraded contracts
  "0x8cb4ae3b": {
    name: "NotGardenMember",
    message: "You are not a member of this garden",
    action: "Please join the garden before submitting work",
    recoverable: false,
    suggestedAction: "join-garden",
  },
  // New selector for NotGardenMember() - keccak256("NotGardenMember()")[0:4]
  "0x1648fd01": {
    name: "NotGardenMember",
    message: "You are not a member of this garden",
    action: "Please join the garden before submitting work",
    recoverable: false,
    suggestedAction: "join-garden",
  },
  "0x30cd7471": {
    name: "NotGardenOwner",
    message: "Only the garden owner can perform this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x5d91fb09": {
    name: "NotGardenOperator",
    message: "Only garden operators can perform this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xdb926eba": {
    name: "InvalidInvite",
    message: "This garden is invite-only",
    action: "Request an invite from a garden operator to join",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x42375a1e": {
    name: "AlreadyGardener",
    message: "You are already a member of this garden",
    recoverable: false, // Not an error state, just informational
  },
  "0x3c6e2a8f": {
    name: "TooManyGardeners",
    message: "This garden has reached its maximum member capacity",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x5d91fb08": {
    name: "TooManyOperators",
    message: "This garden has reached its maximum operator capacity",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x4e487b71": {
    name: "GAPProjectNotInitialized",
    message: "Karma GAP project not initialized for this garden",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // ActionRegistry errors
  "0x82b42900": {
    name: "NotActionOwner",
    message: "Only the action owner can modify this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x8baa579f": {
    name: "InvalidAction",
    message: "Invalid action configuration",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // WorkResolver errors
  "0x2ff9aed3": {
    name: "NotActiveAction",
    message: "This action has expired and is no longer accepting work submissions",
    action: "Select an active action to submit work for",
    recoverable: false, // Need to select different action
  },
  "0x5b634bd2": {
    name: "NotInActionRegistry",
    message: "This action does not exist in the registry",
    action: "Select a valid action to submit work for",
    recoverable: false,
  },

  // WorkApprovalResolver errors
  "0x48f5c3ed": {
    name: "InvalidAttestation",
    message: "Invalid work attestation",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x5d91fb10": {
    name: "NotAuthorizedApprover",
    message: "You are not authorized to approve work in this garden",
    action: "Only garden operators can approve work",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // Common ERC-721 / Token errors
  "0xceea21b6": {
    name: "ERC721NonexistentToken",
    message: "Garden token does not exist",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x6b2a5f4a": {
    name: "ERC721InvalidOwner",
    message: "Invalid garden owner",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // Generic errors
  "0x": {
    name: "EmptyRevert",
    message: "Transaction reverted with no error message",
    recoverable: true, // Unknown errors may be transient
    suggestedAction: "retry",
  },
};

/**
 * Parsed contract error with context
 */
export interface ParsedContractError {
  /** Original error code or message */
  raw: string;
  /** Error name (e.g., "NotGardenerAccount") */
  name: string;
  /** Human-readable error message */
  message: string;
  /** Optional suggested action for user */
  action?: string;
  /** Whether this is a recognized error */
  isKnown: boolean;
  /** Whether the error is recoverable (user can retry with same data) */
  recoverable: boolean;
  /** Suggested next action for user */
  suggestedAction?: "retry" | "join-garden" | "contact-support" | "check-wallet";
}

/**
 * Extract error signature from various error formats
 */
function extractErrorSignature(error: unknown): string | null {
  if (!error) return null;

  const errorStr = extractErrorMessage(error);

  // Match hex error codes like 0x8cb4ae3b
  const hexMatch = errorStr.match(/0x[a-fA-F0-9]{8}/);
  if (hexMatch) {
    return hexMatch[0].toLowerCase();
  }

  // Match "reverted with reason: <error>"
  const reasonMatch = errorStr.match(/reverted with reason: (\w+)/i);
  if (reasonMatch) {
    return reasonMatch[1];
  }

  // Match custom error patterns from viem
  const customErrorMatch = errorStr.match(/The contract function "(\w+)" reverted/);
  if (customErrorMatch) {
    return customErrorMatch[1];
  }

  return null;
}

/**
 * Parse a contract error into a human-readable format
 *
 * @param error - Error object, string, or hex code
 * @returns Parsed error with name, message, recovery info, and optional action
 *
 * @example
 * ```typescript
 * const parsed = parseContractError("0x8cb4ae3b");
 * // {
 * //   raw: "0x8cb4ae3b",
 * //   name: "NotGardenMember",
 * //   message: "You are not a member of this garden",
 * //   action: "Please join the garden before submitting work",
 * //   isKnown: true,
 * //   recoverable: false,
 * //   suggestedAction: "join-garden"
 * // }
 * ```
 */
export function parseContractError(error: unknown): ParsedContractError {
  const errorStr = extractErrorMessage(error);
  const signature = extractErrorSignature(error);

  // Check if we have a known error
  if (signature && ERROR_SIGNATURES[signature]) {
    const knownError = ERROR_SIGNATURES[signature];
    return {
      raw: signature,
      name: knownError.name,
      message: knownError.message,
      action: knownError.action,
      isKnown: true,
      recoverable: knownError.recoverable,
      suggestedAction: knownError.suggestedAction,
    };
  }

  // Check if error string contains known error name
  for (const [_sig, errorInfo] of Object.entries(ERROR_SIGNATURES)) {
    if (errorStr.toLowerCase().includes(errorInfo.name.toLowerCase())) {
      return {
        raw: signature ?? errorStr,
        name: errorInfo.name,
        message: errorInfo.message,
        action: errorInfo.action,
        isKnown: true,
        recoverable: errorInfo.recoverable,
        suggestedAction: errorInfo.suggestedAction,
      };
    }
  }

  // Check for manual validation errors (from simulation)
  if (errorStr.includes("Validation failed")) {
    // Clean up the message (remove "Error: " prefix if present)
    const cleanMessage = errorStr.replace(/^Error:\s*/, "");
    return {
      raw: signature ?? errorStr,
      name: "Validation Error",
      message: cleanMessage,
      isKnown: true,
      recoverable: false,
      suggestedAction: "contact-support",
    };
  }

  // Check for network/timeout errors (recoverable)
  if (
    errorStr.toLowerCase().includes("timeout") ||
    errorStr.toLowerCase().includes("network") ||
    errorStr.toLowerCase().includes("connection")
  ) {
    return {
      raw: signature ?? errorStr,
      name: "NetworkError",
      message: "Network error occurred. Please check your connection and try again.",
      isKnown: true,
      recoverable: true,
      suggestedAction: "retry",
    };
  }

  // Check for user rejection (not recoverable in the traditional sense)
  if (
    errorStr.toLowerCase().includes("user rejected") ||
    errorStr.toLowerCase().includes("user denied") ||
    errorStr.toLowerCase().includes("rejected the request")
  ) {
    return {
      raw: signature ?? errorStr,
      name: "UserRejected",
      message: "Transaction was rejected. Please try again when ready.",
      isKnown: true,
      recoverable: true,
      suggestedAction: "retry",
    };
  }

  // Unknown error - return generic message (assume recoverable for retry)
  return {
    raw: signature ?? errorStr,
    name: "UnknownError",
    message: signature
      ? `Transaction failed with error code: ${signature}`
      : "Transaction failed. Please try again.",
    isKnown: false,
    recoverable: true, // Unknown errors may be transient
    suggestedAction: "retry",
  };
}

/**
 * Check if an error is a "not a garden member" error
 * (user is neither a gardener nor an operator of the garden)
 */
export function isNotGardenMemberError(error: unknown): boolean {
  const parsed = parseContractError(error);
  // Check for both old (NotGardenerAccount) and new (NotGardenMember) error names
  return parsed.name === "NotGardenMember" || parsed.name === "NotGardenerAccount";
}

/**
 * @deprecated Use isNotGardenMemberError instead
 */
export function isNotGardenerError(error: unknown): boolean {
  return isNotGardenMemberError(error);
}

/**
 * Check if an error is an "already a member" error
 */
export function isAlreadyGardenerError(error: unknown): boolean {
  const parsed = parseContractError(error);
  return parsed.name === "AlreadyGardener";
}

/**
 * Format a parsed error for display in toast notifications
 *
 * @param parsed - Parsed contract error
 * @returns Object with title and message for toast
 */
export function formatErrorForToast(parsed: ParsedContractError): {
  title: string;
  message: string;
} {
  if (parsed.isKnown) {
    return {
      title: parsed.name.replace(/([A-Z])/g, " $1").trim(),
      message: parsed.action ? `${parsed.message}. ${parsed.action}` : parsed.message,
    };
  }

  return {
    title: "Transaction Failed",
    message: parsed.message,
  };
}

/**
 * Parse and format an error in one step for immediate use in error handlers
 *
 * @param error - Any error object
 * @returns Formatted error ready for toast display
 *
 * @example
 * ```typescript
 * try {
 *   await submitWork();
 * } catch (error) {
 *   const { title, message } = parseAndFormatError(error);
 *   toast.error({ title, message });
 * }
 * ```
 */
export function parseAndFormatError(error: unknown): {
  title: string;
  message: string;
  parsed: ParsedContractError;
} {
  const parsed = parseContractError(error);
  const { title, message } = formatErrorForToast(parsed);
  return { title, message, parsed };
}
