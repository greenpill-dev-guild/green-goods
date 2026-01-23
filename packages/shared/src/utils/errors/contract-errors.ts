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
 *
 * Selectors are calculated using: cast sig "ErrorName()"
 * Run `cast sig "ErrorName()"` to get the 4-byte selector for any error.
 *
 * Last updated: 2026-01-18 (synced with deployed contracts)
 */
const ERROR_SIGNATURES: Record<string, ErrorInfo> = {
  // ============================================================================
  // GardenAccount.sol errors
  // ============================================================================
  "0xd8cae624": {
    name: "NotGardenOwner",
    message: "Only the garden owner can perform this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xf3aeae14": {
    name: "NotGardenOperator",
    message: "Only garden operators can perform this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x7046c88d": {
    name: "NotAuthorizedCaller",
    message: "You are not authorized to perform this action",
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
  "0xd7a6868a": {
    name: "TooManyGardeners",
    message: "This garden has reached its maximum member capacity",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x6055dca1": {
    name: "TooManyOperators",
    message: "This garden has reached its maximum operator capacity",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x04f102a3": {
    name: "GAPProjectNotInitialized",
    message: "Karma GAP project not initialized for this garden",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x84352a01": {
    name: "GAPNotSupportedOnChain",
    message: "Karma GAP is not supported on this network",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x17c3402f": {
    name: "GAPImpactCreationFailed",
    message: "Failed to create impact attestation on Karma GAP",
    action: "The work was approved but GAP impact creation failed",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xe80dd52b": {
    name: "GAPMilestoneCreationFailed",
    message: "Failed to create milestone on Karma GAP",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // ============================================================================
  // GardenToken.sol errors
  // ============================================================================
  "0x955c501b": {
    name: "UnauthorizedMinter",
    message: "You are not authorized to mint garden tokens",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x3b674d96": {
    name: "DeploymentRegistryNotConfigured",
    message: "Deployment registry is not configured",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x7862e959": {
    name: "InvalidBatchSize",
    message: "Invalid batch size for minting operation",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xd3a3f278": {
    name: "InvalidCommunityToken",
    message: "Invalid community token address",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xd0acc0d3": {
    name: "CommunityTokenNotContract",
    message: "Community token address is not a contract",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x9904b624": {
    name: "InvalidERC20Token",
    message: "Invalid ERC20 token for community token",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // ============================================================================
  // ActionRegistry.sol errors
  // ============================================================================
  "0x43133453": {
    name: "EndTimeBeforeStartTime",
    message: "Action end time cannot be before start time",
    action: "Please adjust the action time range",
    recoverable: false,
  },
  "0xf70f6ef1": {
    name: "StartTimeAfterEndTime",
    message: "Action start time cannot be after end time",
    action: "Please adjust the action time range",
    recoverable: false,
  },

  // ============================================================================
  // WorkResolver.sol errors
  // ============================================================================
  // Current selector for NotGardenMember()
  "0xfdb31dd5": {
    name: "NotGardenMember",
    message: "You are not a member of this garden",
    action: "Please join the garden before submitting work",
    recoverable: false,
    suggestedAction: "join-garden",
  },
  // Legacy selector (NotGardenerAccount) - kept for backward compatibility
  "0x8cb4ae3b": {
    name: "NotGardenMember",
    message: "You are not a member of this garden",
    action: "Please join the garden before submitting work",
    recoverable: false,
    suggestedAction: "join-garden",
  },
  "0x2ff9aed3": {
    name: "NotActiveAction",
    message: "This action has expired and is no longer accepting work submissions",
    action: "Select an active action to submit work for",
    recoverable: false,
  },
  "0x5b634bd2": {
    name: "NotInActionRegistry",
    message: "This action does not exist in the registry",
    action: "Select a valid action to submit work for",
    recoverable: false,
  },

  // ============================================================================
  // WorkApprovalResolver.sol errors
  // ============================================================================
  "0x6beb8978": {
    name: "NotInWorkRegistry",
    message: "This work submission does not exist",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // ============================================================================
  // AssessmentResolver.sol errors
  // ============================================================================
  "0xceaa3788": {
    name: "TitleRequired",
    message: "Assessment title is required",
    action: "Please provide a title for the assessment",
    recoverable: false,
  },
  "0xd40cd602": {
    name: "AssessmentTypeRequired",
    message: "Assessment type is required",
    action: "Please select an assessment type",
    recoverable: false,
  },
  "0x465e359e": {
    name: "AtLeastOneCapitalRequired",
    message: "At least one capital type must be selected",
    action: "Please select at least one capital type for the assessment",
    recoverable: false,
  },
  "0x4e5aca13": {
    name: "InvalidCapital",
    message: "Invalid capital type specified",
    action: "Please select a valid capital type",
    recoverable: false,
  },

  // ============================================================================
  // GardenerRegistry.sol errors (ENS)
  // ============================================================================
  "0xa18ea0b6": {
    name: "NameNotAvailable",
    message: "This name is already taken",
    action: "Please choose a different name",
    recoverable: false,
  },
  "0x430f13b3": {
    name: "InvalidName",
    message: "Invalid name format",
    action: "Please use only lowercase letters, numbers, and hyphens",
    recoverable: false,
  },
  "0x5c427cd9": {
    name: "UnauthorizedCaller",
    message: "You are not authorized to perform this action",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x88be8a3b": {
    name: "ENSNotConfigured",
    message: "ENS is not configured for this network",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xe5aaacea": {
    name: "InvalidCredentialId",
    message: "Invalid credential ID",
    recoverable: false,
    suggestedAction: "contact-support",
  },

  // ============================================================================
  // Karma.sol and TBA.sol errors
  // ============================================================================
  "0x3cb9b437": {
    name: "KarmaGAPNotSupported",
    message: "Karma GAP is not supported",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x7a47c9a2": {
    name: "InvalidChainId",
    message: "Invalid chain ID for this operation",
    recoverable: false,
    suggestedAction: "check-wallet",
  },

  // ============================================================================
  // Common ERC-721 / OpenZeppelin errors
  // ============================================================================
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

  // ============================================================================
  // Generic errors
  // ============================================================================
  "0x": {
    name: "EmptyRevert",
    message: "Transaction reverted with no error message",
    recoverable: true,
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
