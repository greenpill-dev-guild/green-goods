/**
 * Mutation Error Handler Factory
 *
 * Creates standardized error handlers for TanStack Query mutations.
 * Reduces code duplication across work, approval, and garden operation hooks.
 *
 * @module utils/errors/mutation-error-handler
 */

import { toastService, walletProgressToasts } from "../../components/toast";
import { trackContractError } from "../../modules/app/error-tracking";
import { DEBUG_ENABLED, debugError } from "../../utils/debug";
import { parseAndFormatError, type ParsedContractError } from "./contract-errors";

/**
 * Configuration for creating a mutation error handler
 */
export interface MutationErrorHandlerConfig {
  /** Source identifier for error tracking (e.g., "useWorkMutation") */
  source: string;
  /** Context for toast notifications (e.g., "work upload") */
  toastContext: string;
  /** Toast ID for dismissable toasts */
  toastId?: string;
  /** Analytics tracking function */
  trackError?: (error: string, metadata?: Record<string, unknown>) => void;
  /** Get fallback message based on auth mode */
  getFallbackMessage?: (authMode: "wallet" | "passkey" | null) => string;
  /** Get fallback description based on auth mode */
  getFallbackDescription?: (authMode: "wallet" | "passkey" | null) => string;
  /** Use wallet progress toast style for wallet mode */
  useWalletProgressToast?: boolean;
}

/**
 * Context provided to the error handler at call time
 */
export interface MutationErrorContext {
  /** Current authentication mode */
  authMode?: "wallet" | "passkey" | null;
  /** Garden address for tracking */
  gardenAddress?: string | null;
  /** Additional metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Result from the error handler
 */
export interface MutationErrorResult {
  /** Parsed error information */
  parsed: ParsedContractError;
  /** Title for display */
  title: string;
  /** Message for display */
  message: string;
}

/**
 * Creates a reusable mutation error handler with consistent behavior
 *
 * @param config - Handler configuration
 * @returns Error handler function
 *
 * @example
 * ```typescript
 * const handleError = createMutationErrorHandler({
 *   source: "useWorkMutation",
 *   toastContext: "work upload",
 *   toastId: "work-upload",
 *   trackError: (error, metadata) => trackWorkSubmissionFailed({ error, ...metadata }),
 *   useWalletProgressToast: true,
 * });
 *
 * // In mutation onError:
 * onError: (error, variables) => {
 *   handleError(error, {
 *     authMode,
 *     gardenAddress,
 *     metadata: { actionUID, imageCount: variables?.images.length },
 *   });
 * }
 * ```
 */
export function createMutationErrorHandler(config: MutationErrorHandlerConfig) {
  const {
    source,
    toastContext,
    toastId,
    trackError,
    getFallbackMessage,
    getFallbackDescription,
    useWalletProgressToast = false,
  } = config;

  return (error: unknown, context: MutationErrorContext = {}): MutationErrorResult => {
    const { authMode, gardenAddress, metadata = {} } = context;

    // Parse contract error for user-friendly message
    const { title, message, parsed } = parseAndFormatError(error);

    // Track error with analytics if provided
    if (trackError) {
      trackError(parsed.message || (error instanceof Error ? error.message : "Unknown error"), {
        gardenAddress,
        authMode,
        ...metadata,
      });
    }

    // Track as structured exception for error dashboard
    trackContractError(error, {
      source,
      gardenAddress: gardenAddress ?? undefined,
      authMode,
      userAction: toastContext,
      metadata: {
        parsedErrorName: parsed.name,
        isKnown: parsed.isKnown,
        ...metadata,
      },
    });

    // Determine display message
    const displayMessage = parsed.isKnown
      ? message
      : getFallbackMessage
        ? getFallbackMessage(authMode ?? null)
        : "Transaction failed. Please try again.";

    // Determine display title
    const displayTitle = parsed.isKnown ? title : `${toastContext.charAt(0).toUpperCase() + toastContext.slice(1)} failed`;

    // Show error toast
    if (useWalletProgressToast && authMode === "wallet") {
      walletProgressToasts.error(displayMessage, parsed.recoverable ?? false);
    } else {
      const description = parsed.isKnown
        ? parsed.action || undefined
        : getFallbackDescription
          ? getFallbackDescription(authMode ?? null)
          : undefined;

      toastService.error({
        id: toastId,
        title: displayTitle,
        message: displayMessage,
        context: toastContext,
        description,
        error,
      });
    }

    // Debug logging
    if (DEBUG_ENABLED) {
      debugError(`[${source}] ${toastContext} failed`, error, {
        gardenAddress,
        authMode,
        parsedError: parsed.name,
        message: displayMessage,
        ...metadata,
      });
    }

    return { parsed, title: displayTitle, message: displayMessage };
  };
}

/**
 * Creates a simple error handler for draft mutations
 * Uses a consistent pattern for all draft operations
 *
 * @param action - The action being performed (e.g., "create", "update", "delete")
 * @returns Error handler function for mutation onError
 */
export function createDraftErrorHandler(action: string) {
  return (error: unknown): void => {
    toastService.error({
      title: `Failed to ${action} draft`,
      message: error instanceof Error ? error.message : "Please try again.",
      context: `draft ${action}`,
      error,
    });
  };
}
