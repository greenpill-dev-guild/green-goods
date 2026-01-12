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
 * Uses `error_tracked` custom events for detailed context. PostHog's built-in
 * `capture_exceptions` option handles native exception format automatically.
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

  // Build the error properties
  const properties: Record<string, unknown> = {
    // Error details
    error_type: normalizedError.name || "Error",
    error_message: normalizedError.message,
    error_stack: normalizedError.stack,

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

    // Fingerprint for grouping similar errors
    error_fingerprint: generateErrorFingerprint(normalizedError, {
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
// UPLOAD ERROR TRACKING
// ============================================================================

export type UploadErrorCategory = "ipfs_init" | "file_upload" | "json_upload" | "encoding";

export interface UploadErrorContext extends Omit<ErrorContext, "category"> {
  /** Type of upload that failed */
  uploadCategory: UploadErrorCategory;
  /** File index if uploading multiple files */
  fileIndex?: number;
  /** Total files being uploaded */
  totalFiles?: number;
  /** File size in bytes */
  fileSize?: number;
  /** File type/mime type */
  fileType?: string;
  /** File name (if available) */
  fileName?: string;
  /** IPFS client initialization status */
  ipfsStatus?: "not_started" | "in_progress" | "success" | "failed" | "skipped_no_config";
  /** Duration of the upload attempt in milliseconds */
  uploadDurationMs?: number;
}

/**
 * Track an upload-related error with detailed file and IPFS context.
 *
 * Use this for IPFS upload failures to capture all the information needed
 * to debug why uploads are failing.
 *
 * @example
 * ```typescript
 * try {
 *   await uploadFileToIPFS(file);
 * } catch (error) {
 *   trackUploadError(error, {
 *     uploadCategory: "file_upload",
 *     fileIndex: 0,
 *     totalFiles: 3,
 *     fileSize: file.size,
 *     fileType: file.type,
 *     fileName: file.name,
 *     source: "encodeWorkData",
 *     gardenAddress: "0x...",
 *   });
 * }
 * ```
 */
export function trackUploadError(error: unknown, context: UploadErrorContext): void {
  const {
    uploadCategory,
    fileIndex,
    totalFiles,
    fileSize,
    fileType,
    fileName,
    ipfsStatus,
    uploadDurationMs,
    ...baseContext
  } = context;

  trackError(error, {
    ...baseContext,
    category: "storage",
    severity: context.severity ?? "error",
    recoverable: context.recoverable ?? true,
    metadata: {
      ...context.metadata,
      upload_category: uploadCategory,
      file_index: fileIndex,
      total_files: totalFiles,
      file_size_bytes: fileSize,
      file_size_kb: fileSize ? Math.round(fileSize / 1024) : undefined,
      file_type: fileType,
      file_name: fileName,
      ipfs_status: ipfsStatus,
      upload_duration_ms: uploadDurationMs,
    },
  });
}

/**
 * Track successful upload for performance monitoring.
 * Only sends data in production to avoid noise in development.
 */
export function trackUploadSuccess(context: {
  uploadCategory: UploadErrorCategory;
  fileIndex?: number;
  totalFiles?: number;
  fileSize?: number;
  fileType?: string;
  uploadDurationMs: number;
  cid?: string;
  source?: string;
  gardenAddress?: string;
}): void {
  // Import track here to avoid circular dependency issues
  // This is fine since it's a lazy import for analytics only
  import("./posthog").then(({ track }) => {
    track("upload_success", {
      upload_category: context.uploadCategory,
      file_index: context.fileIndex,
      total_files: context.totalFiles,
      file_size_bytes: context.fileSize,
      file_size_kb: context.fileSize ? Math.round(context.fileSize / 1024) : undefined,
      file_type: context.fileType,
      upload_duration_ms: context.uploadDurationMs,
      cid: context.cid,
      source: context.source,
      garden_address: context.gardenAddress,
    });
  });
}

/**
 * Track batch upload progress for debugging multi-file uploads.
 */
export function trackUploadBatchProgress(context: {
  stage: "started" | "file_complete" | "completed" | "failed";
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalSizeBytes: number;
  elapsedMs: number;
  source?: string;
  gardenAddress?: string;
  error?: string;
}): void {
  import("./posthog").then(({ track }) => {
    track("upload_batch_progress", {
      stage: context.stage,
      total_files: context.totalFiles,
      completed_files: context.completedFiles,
      failed_files: context.failedFiles,
      total_size_bytes: context.totalSizeBytes,
      total_size_kb: Math.round(context.totalSizeBytes / 1024),
      elapsed_ms: context.elapsedMs,
      source: context.source,
      garden_address: context.gardenAddress,
      error: context.error,
    });
  });
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
