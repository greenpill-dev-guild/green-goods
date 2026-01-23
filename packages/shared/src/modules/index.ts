// Modules — EXPLICIT EXPORTS for tree-shaking

export {
  ANALYTICS_EVENTS,
  trackAdminDeployFailed,
  // Admin: deployment events
  trackAdminDeployStarted,
  trackAdminDeploySuccess,
  trackAdminGardenCreateFailed,
  // Admin: garden events
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
  trackAdminMemberAddFailed,
  // Admin: member events
  trackAdminMemberAddStarted,
  trackAdminMemberAddSuccess,
  trackAdminMemberRemoveFailed,
  trackAdminMemberRemoveStarted,
  trackAdminMemberRemoveSuccess,
  trackAuthPasskeyLoginFailed,
  trackAuthPasskeyLoginStarted,
  trackAuthPasskeyLoginSuccess,
  trackAuthPasskeyRegisterFailed,
  // Auth events
  trackAuthPasskeyRegisterStarted,
  trackAuthPasskeyRegisterSuccess,
  trackAuthSessionRestored,
  trackAuthSwitchMethod,
  trackAuthWalletConnectFailed,
  trackAuthWalletConnectStarted,
  trackAuthWalletConnectSuccess,
  trackGardenAutoJoinFailed,
  trackGardenAutoJoinStarted,
  trackGardenAutoJoinSuccess,
  trackGardenJoinAlreadyMember,
  trackGardenJoinFailed,
  // Garden join events
  trackGardenJoinStarted,
  trackGardenJoinSuccess,
  trackWorkApprovalFailed,
  // Work approval events
  trackWorkApprovalStarted,
  trackWorkApprovalSuccess,
  trackWorkRejectionSuccess,
  trackWorkSubmissionFailed,
  trackWorkSubmissionOffline,
  trackWorkSubmissionQueued,
  // Work submission events
  trackWorkSubmissionStarted,
  trackWorkSubmissionSuccess,
} from "./app/analytics-events";
// ============================================================================
// APP / ERROR TRACKING
// ============================================================================
export {
  // Breadcrumbs
  addBreadcrumb,
  type BreadcrumbEntry,
  clearBreadcrumbs,
  type ErrorCategory,
  type ErrorContext,
  // Types
  type ErrorSeverity,
  getBreadcrumbs,
  // Global handlers
  initGlobalErrorHandlers,
  trackAuthError,
  // Category-specific tracking
  trackContractError,
  // Core error tracking
  trackError,
  // React Error Boundary helper
  trackErrorBoundary,
  trackErrorRecovery,
  // Recovery tracking
  trackErrorRetry,
  trackFatalError,
  trackGraphQLError,
  trackNetworkError,
  trackStorageError,
  trackSyncError,
  trackUploadBatchProgress,
  // Upload tracking
  trackUploadError,
  trackUploadSuccess,
  trackWarning,
  type UploadErrorCategory,
  type UploadErrorContext,
} from "./app/error-tracking";
// ============================================================================
// APP / ANALYTICS
// ============================================================================
export {
  getDistinctId,
  identify,
  identifyWithProperties,
  reset,
  track,
  trackAppLifecycle,
  trackOfflineEvent,
  trackSyncPerformance,
} from "./app/posthog";

// ============================================================================
// APP / SERVICE WORKER
// ============================================================================
export { serviceWorkerManager } from "./app/service-worker";

// ============================================================================
// AUTH / SESSION
// ============================================================================
export {
  // Storage keys
  AUTH_MODE_STORAGE_KEY,
  // Auth mode
  type AuthMode,
  clearAllAuth,
  clearAuthMode,
  // Legacy (deprecated - credentials now on Pimlico server)
  clearStoredPasskey,
  clearStoredRpId,
  // Username (Pimlico server)
  clearStoredUsername,
  getAuthMode,
  getStoredRpId,
  getStoredUsername,
  hasStoredPasskey,
  hasStoredUsername,
  PASSKEY_STORAGE_KEY,
  // RP ID (Android passkey compatibility)
  RP_ID_STORAGE_KEY,
  setAuthMode,
  setStoredRpId,
  setStoredUsername,
  USERNAME_STORAGE_KEY,
} from "./auth/session";

// ============================================================================
// DATA / EAS
// ============================================================================
export {
  getGardenAssessments,
  getWorkApprovals,
  getWorks,
  getWorksByGardener,
} from "./data/eas";

// ============================================================================
// DATA / GRAPHQL
// ============================================================================
export type { FragmentOf, ResultOf, VariablesOf } from "./data/graphql";
export { easGraphQL, greenGoodsGraphQL } from "./data/graphql";
// ============================================================================
// DATA / GRAPHQL CLIENT
// ============================================================================
export {
  createEasClient,
  createIndexerClient,
  GQLClient,
  GRAPHQL_TIMEOUT_MS,
  greenGoodsIndexer,
  // Timeout utilities
  INDEXER_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from "./data/graphql-client";
// ============================================================================
// DATA / GREENGOODS
// ============================================================================
export {
  Capital,
  getActions,
  getGardeners,
  getGardens,
  updateUserProfile,
} from "./data/greengoods";
// ============================================================================
// DATA / IPFS (Storacha)
// ============================================================================
export {
  // Upload context types
  type FileUploadContext,
  getFileByHash,
  getIpfsInitStatus,
  initializeIpfs,
  initializeIpfsFromEnv,
  // Deprecated aliases for backward compatibility
  initializePinata,
  initializePinataFromEnv,
  // Storacha aliases (preferred naming)
  initializeStoracha,
  initializeStorachaFromEnv,
  type JsonUploadContext,
  resolveAvatarUrl,
  resolveImageUrl,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./data/ipfs";

// ============================================================================
// JOB QUEUE
// ============================================================================
export {
  createOfflineTxHash,
  jobQueue,
  jobQueueDB,
  jobQueueEventBus,
  mediaResourceManager,
  useJobQueueEvents,
} from "./job-queue";

// ============================================================================
// TRANSLATION
// ============================================================================
export { browserTranslator } from "./translation/browser-translator";
export { translationCache } from "./translation/db";
export { runTranslationDiagnostics } from "./translation/diagnostics";

// ============================================================================
// WORK / BOT SUBMISSION
// ============================================================================
export { submitApprovalBot, submitWorkBot } from "./work/bot-submission";

// ============================================================================
// WORK / PASSKEY SUBMISSION
// ============================================================================
export type {
  PasskeyApprovalSubmissionParams,
  PasskeyWorkSubmissionParams,
} from "./work/passkey-submission";
export {
  submitApprovalWithPasskey,
  submitWorkWithPasskey,
} from "./work/passkey-submission";

// ============================================================================
// WORK / WORK SUBMISSION
// ============================================================================
export {
  formatJobError,
  getSubmissionStatusText,
  validateApprovalDraft,
  validateWorkDraft,
} from "./work/work-submission";
