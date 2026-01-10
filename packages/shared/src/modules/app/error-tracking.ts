/**
 * Error Tracking Module
 *
 * Provides structured error tracking for PostHog with:
 * - Severity levels (fatal, error, warning, info)
 * - Error categorization (contract, network, auth, validation, system)
 * - Breadcrumb/activity trail support
 * - Global error handler setup
 * - Integration with contract error parsing
 *
 * PostHog expects `$exception` events for error tracking dashboards.
 *
 * @module modules/app/error-tracking
 */

import { posthog } from "posthog-js";
import { track } from "./posthog";
import { parseContractError, type ParsedContractError } from "../../utils/errors/contract-errors";

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

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
  authMode?: "passkey" | "wallet" | null;
  /** Whether user was offline when error occurred */
  isOffline?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Whether this error is recoverable (user can retry) */
  recoverable?: boolean;
  /** Parsed contract error details */
  contractError?: ParsedContractError;
}

export interface BreadcrumbEntry {
  /** When the action occurred */
  timestamp: number;
  /** What the user did */
  action: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

// ============================================================================
// BREADCRUMB TRAIL
// ============================================================================

const MAX_BREADCRUMBS = 20;
const breadcrumbs: BreadcrumbEntry[] = [];

/**
 * Add a breadcrumb to track user actions before an error.
 * Breadcrumbs are included in error reports to help debug.
 */
export function addBreadcrumb(action: string, data?: Record<string, unknown>): void {
  breadcrumbs.push({
    timestamp: Date.now(),
    action,
    data,
  });

  // Keep only the most recent breadcrumbs
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }

  if (IS_DEBUG) {
    console.log(`[ErrorTracking] Breadcrumb: ${action}`, data);
  }
}

/**
 * Get recent breadcrumbs for error context.
 */
export function getBreadcrumbs(): BreadcrumbEntry[] {
  return [...breadcrumbs];
}

/**
 * Clear all breadcrumbs (e.g., on logout).
 */
export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
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
 * This sends a `$exception` event which PostHog uses for error analytics.
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

  // Build the exception properties
  const properties: Record<string, unknown> = {
    // Standard PostHog exception fields
    $exception_type: normalizedError.name || "Error",
    $exception_message: normalizedError.message,
    $exception_stack_trace_raw: normalizedError.stack,

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

    // Contract error details
    contract_error_name: parsedContractError?.name,
    contract_error_known: parsedContractError?.isKnown,
    contract_error_raw: parsedContractError?.raw,
    contract_suggested_action: parsedContractError?.suggestedAction,

    // Breadcrumbs for debugging
    breadcrumbs: getBreadcrumbs().slice(-10), // Last 10 actions

    // Fingerprint for deduplication
    $exception_fingerprint: generateErrorFingerprint(normalizedError, {
      ...context,
      contractError: parsedContractError,
    }),

    // Additional metadata
    ...metadata,
  };

  if (IS_DEBUG) {
    console.log(`[ErrorTracking] ${severity.toUpperCase()}: ${normalizedError.message}`, {
      category,
      source,
      properties,
    });
  }

  // Skip in dev mode
  if (IS_DEV) return;
  if (!isPostHogReady()) {
    if (IS_DEBUG) {
      console.warn("[ErrorTracking] PostHog not ready, skipping capture");
    }
    return;
  }

  // Send as $exception event (PostHog's expected format for error tracking)
  posthog.capture("$exception", properties);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Track a fatal error (app-crashing errors).
 */
export function trackFatalError(error: unknown, context: Omit<ErrorContext, "severity"> = {}): void {
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

// ============================================================================
// ERROR RECOVERY TRACKING
// ============================================================================

/**
 * Track when a user retries after an error.
 */
export function trackErrorRetry(originalError: unknown, context: ErrorContext = {}): void {
  const normalizedError =
    originalError instanceof Error
      ? originalError
      : new Error(typeof originalError === "string" ? originalError : String(originalError));

  track("error_retry_attempted", {
    error_message: normalizedError.message,
    error_category: context.category,
    source: context.source,
    garden_address: context.gardenAddress,
    auth_mode: context.authMode,
  });
}

/**
 * Track when a user successfully recovers from an error.
 */
export function trackErrorRecovery(originalError: unknown, context: ErrorContext = {}): void {
  const normalizedError =
    originalError instanceof Error
      ? originalError
      : new Error(typeof originalError === "string" ? originalError : String(originalError));

  track("error_recovery_success", {
    error_message: normalizedError.message,
    error_category: context.category,
    source: context.source,
    garden_address: context.gardenAddress,
    auth_mode: context.authMode,
  });
}

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

let globalHandlersInitialized = false;

/**
 * Initialize global error handlers for uncaught errors and promise rejections.
 *
 * Call this once at app startup (e.g., in main.tsx).
 * This catches errors that escape React Error Boundaries.
 */
export function initGlobalErrorHandlers(): void {
  if (globalHandlersInitialized) return;
  if (typeof window === "undefined") return;

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    // Ignore errors from browser extensions or cross-origin scripts
    if (!event.filename || event.filename.includes("extension://")) return;

    trackError(event.error || new Error(event.message), {
      severity: "fatal",
      category: "system",
      source: "window.onerror",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    // Try to categorize the error
    let category: ErrorCategory = "system";
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      category = "network";
    } else if (message.includes("0x") || message.includes("revert")) {
      category = "contract";
    } else if (message.includes("graphql") || message.includes("query")) {
      category = "graphql";
    }

    trackError(error, {
      severity: "error",
      category,
      source: "unhandledrejection",
    });
  });

  globalHandlersInitialized = true;

  if (IS_DEBUG) {
    console.log("[ErrorTracking] Global error handlers initialized");
  }
}

// ============================================================================
// REACT ERROR BOUNDARY HELPER
// ============================================================================

/**
 * Track an error caught by a React Error Boundary.
 * Use this in componentDidCatch to properly track React errors.
 *
 * @example
 * ```typescript
 * componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 *   trackErrorBoundary(error, {
 *     componentStack: errorInfo.componentStack,
 *     boundaryName: "AppErrorBoundary",
 *   });
 * }
 * ```
 */
export function trackErrorBoundary(
  error: Error,
  options: {
    componentStack?: string | null;
    boundaryName?: string;
    isOffline?: boolean;
    isNetwork?: boolean;
  } = {}
): void {
  const { componentStack, boundaryName = "ErrorBoundary", isOffline, isNetwork } = options;

  // Determine category based on error characteristics
  let category: ErrorCategory = "system";
  if (isNetwork) {
    category = "network";
  } else if (isOffline) {
    category = "sync";
  }

  trackError(error, {
    severity: "fatal",
    category,
    source: boundaryName,
    isOffline,
    metadata: {
      component_stack: componentStack?.slice(0, 2000), // Limit size
      boundary_name: boundaryName,
      is_offline_error: isOffline,
      is_network_error: isNetwork,
    },
  });
}
