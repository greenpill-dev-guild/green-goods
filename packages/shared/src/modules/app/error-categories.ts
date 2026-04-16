/**
 * Error Categorization & Core Tracking
 *
 * Provides the core error tracking function and convenience wrappers.
 * Types, severity levels, error categorization, fingerprinting, and
 * network/device context collection.
 *
 * @module modules/app/error-categories
 */

import { posthog } from "posthog-js";
import { type ParsedContractError, parseContractError } from "../../utils/errors/contract-errors";
import { logger } from "./logger";
import { getAppContext } from "./posthog";
import { getBreadcrumbs } from "./error-breadcrumbs";

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

const PAGE_LOAD_TIME = Date.now();

// ============================================================================
// NETWORK & DEVICE CONTEXT
// ============================================================================

interface NetworkInfo {
  is_online: boolean;
  connection_type?: string;
  downlink_mbps?: number;
  rtt_ms?: number;
}

/**
 * Reads connection quality from the Network Information API.
 * Provides effectiveType (slow-2g/2g/3g/4g), downlink, and RTT.
 * Safe to call in SSR (returns defaults).
 */
export function getNetworkContext(): NetworkInfo {
  if (typeof navigator === "undefined") return { is_online: true };

  const conn = (
    navigator as unknown as {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
      };
    }
  ).connection;

  return {
    is_online: navigator.onLine,
    connection_type: conn?.effectiveType,
    downlink_mbps: conn?.downlink,
    rtt_ms: conn?.rtt,
  };
}

/**
 * Milliseconds since the page was loaded.
 * Useful for identifying errors that happen during startup vs. steady state.
 */
export function getTimeSincePageLoad(): number {
  return Date.now() - PAGE_LOAD_TIME;
}

// ============================================================================
// TYPES
// ============================================================================

export type ErrorSeverity = "fatal" | "error" | "warning" | "info";

export type ErrorCategory =
  | "contract" // Smart contract errors
  | "network" // Network/connectivity errors
  | "auth" // Authentication errors
  | "validation" // Form/input validation errors
  | "storage" // IndexedDB/localStorage errors
  | "sync" // Offline sync errors
  | "graphql" // GraphQL/API errors
  | "system" // System/runtime errors
  | "user_action" // User-initiated actions that failed
  | "unknown"; // Uncategorized errors

export interface ErrorContext {
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Error category for filtering/grouping */
  category?: ErrorCategory;
  /** Where the error occurred (component, hook, function name) */
  source?: string;
  /** User's current action when error occurred */
  userAction?: string;
  /** Garden address if relevant */
  gardenAddress?: string;
  /** Transaction hash if relevant */
  txHash?: string;
  /** Auth mode when error occurred */
  authMode?: "passkey" | "wallet" | "embedded" | null;
  /** Whether user was offline when error occurred */
  isOffline?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Whether this error is recoverable (user can retry) */
  recoverable?: boolean;
  /** Parsed contract error details */
  contractError?: ParsedContractError;
}

// ============================================================================
// ERROR FINGERPRINTING
// ============================================================================

/**
 * Generate a fingerprint for error deduplication.
 * Errors with the same fingerprint are grouped together in PostHog.
 */
function generateErrorFingerprint(error: Error, context: ErrorContext): string {
  const parts: string[] = [];

  // Use error name and first line of message
  parts.push(error.name || "Error");
  const firstLine = error.message?.split("\n")[0]?.slice(0, 100) || "unknown";
  parts.push(firstLine);

  // Include category and source for grouping
  if (context.category) parts.push(context.category);
  if (context.source) parts.push(context.source);

  // For contract errors, use the error signature
  if (context.contractError?.raw) {
    parts.push(context.contractError.raw);
  }

  return parts.join("::");
}

// ============================================================================
// CORE ERROR TRACKING
// ============================================================================

/**
 * Check if PostHog is ready for exception capture.
 */
function isPostHogReady(): boolean {
  try {
    const config = (posthog as unknown as { config?: { api_host?: string } }).config;
    return typeof config !== "undefined" && typeof config.api_host === "string";
  } catch {
    return false;
  }
}

/**
 * Track an error to PostHog with full context.
 *
 * This sends an `error_tracked` event with detailed error context.
 * PostHog's built-in `capture_exceptions` handles the native `$exception`
 * event format automatically - this provides additional structured context.
 *
 * @param error - The error object or message
 * @param context - Additional context about the error
 *
 * @example
 * ```typescript
 * try {
 *   await submitWork(data);
 * } catch (error) {
 *   trackError(error, {
 *     severity: "error",
 *     category: "contract",
 *     source: "useSubmitWork",
 *     gardenAddress: "0x...",
 *   });
 * }
 * ```
 */
export function trackError(error: unknown, context: ErrorContext = {}): void {
  const {
    severity = "error",
    category = "unknown",
    source,
    userAction,
    gardenAddress,
    txHash,
    authMode,
    isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false,
    metadata,
    recoverable,
    contractError,
  } = context;

  // Normalize error to Error object
  const normalizedError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

  // Check if this is a contract error
  let parsedContractError = contractError;
  if (!parsedContractError && category === "contract") {
    parsedContractError = parseContractError(error);
  }

  // Get app context for version and environment
  const appContext = getAppContext();

  // Collect device/network context for every error event
  const networkCtx = getNetworkContext();

  // Preserve original error message when the error was re-wrapped with a user-friendly message.
  // The `cause` chain can contain the raw upstream error (e.g. IPFS gateway timeout).
  const originalErrorMessage =
    normalizedError.cause instanceof Error ? normalizedError.cause.message : undefined;

  // Build the error properties
  const properties: Record<string, unknown> = {
    // App context (version and environment)
    app_version: appContext.app_version,
    environment: appContext.environment,
    chain_id: appContext.chain_id,

    // Error details
    error_type: normalizedError.name || "Error",
    error_message: normalizedError.message,
    error_stack: normalizedError.stack,
    original_error_message: originalErrorMessage,

    // Custom error context
    severity,
    category,
    source,
    user_action: userAction,
    garden_address: gardenAddress,
    tx_hash: txHash,
    auth_mode: authMode,
    is_offline: isOffline,
    recoverable: recoverable ?? parsedContractError?.recoverable,

    // Network & device context (auto-collected)
    connection_type: networkCtx.connection_type,
    connection_downlink_mbps: networkCtx.downlink_mbps,
    connection_rtt_ms: networkCtx.rtt_ms,
    time_since_page_load_ms: getTimeSincePageLoad(),

    // Contract error details
    contract_error_name: parsedContractError?.name,
    contract_error_known: parsedContractError?.isKnown,
    contract_error_raw: parsedContractError?.raw,
    contract_suggested_action: parsedContractError?.suggestedAction,

    // Breadcrumbs for debugging
    breadcrumbs: getBreadcrumbs().slice(-10), // Last 10 actions

    // Fingerprint for grouping similar errors
    error_fingerprint: generateErrorFingerprint(normalizedError, {
      ...context,
      contractError: parsedContractError,
    }),

    // Additional metadata
    ...metadata,
  };

  if (IS_DEBUG) {
    logger.info(`[ErrorTracking] ${severity.toUpperCase()}: ${normalizedError.message}`, {
      category,
      source,
    });
  }

  // Skip in dev mode
  if (IS_DEV) return;
  if (!isPostHogReady()) {
    if (IS_DEBUG) {
      logger.warn("[ErrorTracking] PostHog not ready, skipping capture");
    }
    return;
  }

  // Send as custom event - PostHog's built-in capture_exceptions handles native $exception format
  posthog.capture("error_tracked", properties);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Track a fatal error (app-crashing errors).
 */
export function trackFatalError(
  error: unknown,
  context: Omit<ErrorContext, "severity"> = {}
): void {
  trackError(error, { ...context, severity: "fatal" });
}

/**
 * Track a warning (non-critical errors that should be monitored).
 */
export function trackWarning(error: unknown, context: Omit<ErrorContext, "severity"> = {}): void {
  trackError(error, { ...context, severity: "warning" });
}

/**
 * Track a contract/transaction error.
 */
export function trackContractError(
  error: unknown,
  context: Omit<ErrorContext, "category"> = {}
): void {
  const parsed = parseContractError(error);
  trackError(error, {
    ...context,
    category: "contract",
    contractError: parsed,
    recoverable: parsed.recoverable,
  });
}

/**
 * Track a network error.
 */
export function trackNetworkError(
  error: unknown,
  context: Omit<ErrorContext, "category"> = {}
): void {
  trackError(error, { ...context, category: "network", recoverable: true });
}

/**
 * Track an authentication error.
 */
export function trackAuthError(error: unknown, context: Omit<ErrorContext, "category"> = {}): void {
  trackError(error, { ...context, category: "auth" });
}

/**
 * Track a GraphQL/API error.
 */
export function trackGraphQLError(
  error: unknown,
  context: Omit<ErrorContext, "category"> = {}
): void {
  trackError(error, { ...context, category: "graphql" });
}

/**
 * Track a sync/offline error.
 */
export function trackSyncError(error: unknown, context: Omit<ErrorContext, "category"> = {}): void {
  trackError(error, { ...context, category: "sync" });
}

/**
 * Track a storage error (IndexedDB, localStorage).
 */
export function trackStorageError(
  error: unknown,
  context: Omit<ErrorContext, "category"> = {}
): void {
  trackError(error, { ...context, category: "storage" });
}
