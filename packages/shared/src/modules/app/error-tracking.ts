// Re-export facade — preserves original import paths for consumers

export type { BreadcrumbEntry } from "./error-breadcrumbs";
export { addBreadcrumb, getBreadcrumbs, clearBreadcrumbs } from "./error-breadcrumbs";

export type { ErrorSeverity, ErrorCategory, ErrorContext } from "./error-categories";
export {
  getNetworkContext,
  getTimeSincePageLoad,
  trackError,
  trackFatalError,
  trackWarning,
  trackContractError,
  trackNetworkError,
  trackAuthError,
  trackGraphQLError,
  trackSyncError,
  trackStorageError,
} from "./error-categories";

export type { UploadErrorCategory, UploadErrorContext } from "./error-events";
export {
  trackErrorRetry,
  trackErrorRecovery,
  initGlobalErrorHandlers,
  trackUploadError,
  trackUploadSuccess,
  trackUploadBatchProgress,
  trackErrorBoundary,
} from "./error-events";
