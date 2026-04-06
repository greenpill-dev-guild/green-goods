/**
 * Error Event Tracking
 *
 * Specialized error tracking for: upload errors, error recovery,
 * global error handlers, and React Error Boundary integration.
 *
 * @module modules/app/error-events
 */

import { logger } from "./logger";
import { track } from "./posthog";
import { trackError, type ErrorCategory, type ErrorContext } from "./error-categories";

const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

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
let cleanupGlobalHandlers: (() => void) | null = null;

/**
 * Initialize global error handlers for uncaught errors and promise rejections.
 *
 * Call this once at app startup (e.g., in main.tsx).
 * This catches errors that escape React Error Boundaries.
 *
 * @returns A cleanup function to remove the event listeners
 */
export function initGlobalErrorHandlers(): () => void {
  if (globalHandlersInitialized && cleanupGlobalHandlers) {
    return cleanupGlobalHandlers;
  }
  if (typeof window === "undefined") {
    return () => {};
  }

  // Handle uncaught errors
  const handleError = (event: ErrorEvent) => {
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
  };

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    // Ignore errors originating from browser extensions (PromiseRejectionEvent
    // has no `filename`, so we check the stack trace instead)
    if (error.stack?.includes("extension://")) return;

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
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  globalHandlersInitialized = true;

  if (IS_DEBUG) {
    logger.info("[ErrorTracking] Global error handlers initialized");
  }

  // Return cleanup function
  cleanupGlobalHandlers = () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    globalHandlersInitialized = false;
    cleanupGlobalHandlers = null;

    if (IS_DEBUG) {
      logger.info("[ErrorTracking] Global error handlers cleaned up");
    }
  };

  return cleanupGlobalHandlers;
}

// ============================================================================
// UPLOAD ERROR TRACKING
// ============================================================================

export type UploadErrorCategory = "ipfs_init" | "file_upload" | "json_upload" | "encoding";

export interface UploadErrorContext extends Omit<ErrorContext, "category"> {
  /** Type of upload that failed */
  uploadCategory: UploadErrorCategory;
  /** Batch ID for correlating upload errors with submission errors */
  uploadBatchId?: string;
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
    uploadBatchId,
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
      upload_batch_id: uploadBatchId,
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
  uploadBatchId?: string;
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
      upload_batch_id: context.uploadBatchId,
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
  uploadBatchId?: string;
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
      upload_batch_id: context.uploadBatchId,
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
