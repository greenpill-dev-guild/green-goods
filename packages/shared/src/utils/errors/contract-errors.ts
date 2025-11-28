/**
 * Contract Error Parsing Utilities
 *
 * Parses contract revert errors from UserOperation failures and transaction errors.
 * Provides human-readable messages for common Green Goods contract errors.
 *
 * @module utils/errors/contract-errors
 */

import { type Hex } from "viem";

/**
 * Common contract error signatures and their human-readable messages
 */
const ERROR_SIGNATURES: Record<string, { name: string; message: string; action?: string }> = {
  // GardenAccount errors
  "0x8cb4ae3b": {
    name: "NotGardenerAccount",
    message: "You are not a member of this garden",
    action: "Please join the garden before submitting work",
  },
  "0x30cd7471": {
    name: "NotGardenOwner",
    message: "Only the garden owner can perform this action",
  },
  "0x5d91fb09": {
    name: "NotGardenOperator",
    message: "Only garden operators can perform this action",
  },
  "0xdb926eba": {
    name: "InvalidInvite",
    message: "This garden is invite-only",
    action: "Request an invite from a garden operator to join",
  },
  "0x42375a1e": {
    name: "AlreadyGardener",
    message: "You are already a member of this garden",
  },
  "0x3c6e2a8f": {
    name: "TooManyGardeners",
    message: "This garden has reached its maximum member capacity",
  },
  "0x5d91fb08": {
    name: "TooManyOperators",
    message: "This garden has reached its maximum operator capacity",
  },
  "0x4e487b71": {
    name: "GAPProjectNotInitialized",
    message: "Karma GAP project not initialized for this garden",
  },

  // ActionRegistry errors
  "0x82b42900": {
    name: "NotActionOwner",
    message: "Only the action owner can modify this action",
  },
  "0x8baa579f": {
    name: "InvalidAction",
    message: "Invalid action configuration",
  },

  // WorkApprovalResolver errors
  "0x48f5c3ed": {
    name: "InvalidAttestation",
    message: "Invalid work attestation",
  },
  "0x5d91fb10": {
    name: "NotAuthorizedApprover",
    message: "You are not authorized to approve work in this garden",
    action: "Only garden operators can approve work",
  },

  // Common ERC-721 / Token errors
  "0xceea21b6": {
    name: "ERC721NonexistentToken",
    message: "Garden token does not exist",
  },
  "0x6b2a5f4a": {
    name: "ERC721InvalidOwner",
    message: "Invalid garden owner",
  },

  // Generic errors
  "0x": {
    name: "EmptyRevert",
    message: "Transaction reverted with no error message",
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
}

/**
 * Extract error signature from various error formats
 */
function extractErrorSignature(error: unknown): string | null {
  if (!error) return null;

  const errorStr = String(error);

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
 * @returns Parsed error with name, message, and optional action
 *
 * @example
 * ```typescript
 * const parsed = parseContractError("0x8cb4ae3b");
 * // {
 * //   raw: "0x8cb4ae3b",
 * //   name: "NotGardenerAccount",
 * //   message: "You are not a member of this garden",
 * //   action: "Please join the garden before submitting work",
 * //   isKnown: true
 * // }
 * ```
 */
export function parseContractError(error: unknown): ParsedContractError {
  const errorStr = String(error);
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
    };
  }

  // Unknown error - return generic message
  return {
    raw: signature ?? errorStr,
    name: "UnknownError",
    message: signature
      ? `Transaction failed with error code: ${signature}`
      : "Transaction failed. Please try again.",
    isKnown: false,
  };
}

/**
 * Check if an error is a "user not a gardener" error
 */
export function isNotGardenerError(error: unknown): boolean {
  const parsed = parseContractError(error);
  return parsed.name === "NotGardenerAccount";
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

/**
 * Add a custom error signature to the registry
 * Useful for application-specific errors or new contract versions
 *
 * @param signature - 4-byte error signature (e.g., "0x8cb4ae3b")
 * @param name - Error name
 * @param message - Human-readable message
 * @param action - Optional suggested action
 */
export function registerErrorSignature(
  signature: Hex,
  name: string,
  message: string,
  action?: string
): void {
  ERROR_SIGNATURES[signature.toLowerCase()] = { name, message, action };
}
