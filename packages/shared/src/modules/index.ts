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
  clearStoredRpId,
  // Username (Pimlico server)
  clearStoredUsername,
  getAuthMode,
  getStoredRpId,
  getStoredUsername,
  hasStoredUsername,
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
  TimeoutError,
  withTimeout,
} from "./data/graphql-client";
// ============================================================================
// DATA / GARDENS (Gardens V2 Subgraph)
// ============================================================================
export {
  getConvictionStrategiesFromSubgraph,
  getConvictionWeightsFromSubgraph,
  getGardenCommunityFromSubgraph,
  getGardenPoolsFromSubgraph,
  getMemberPowerFromSubgraph,
  getRegisteredHypercertsFromSubgraph,
} from "./data/gardens";

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
// DATA / HYPERCERTS
// ============================================================================
export {
  type AssessmentMetadataPrefill,
  checkAttestationsBundled,
  domainToActionDomain,
  filterAttestationsByAssessment,
  getApprovedAttestations,
  getGardenHypercerts,
  getHypercertById,
  prefillMetadataFromAssessment,
} from "./data/hypercerts";
// ============================================================================
// DATA / MARKETPLACE (On-chain reads & event queries)
// ============================================================================
export {
  getRegisteredOrders,
  getActiveOrder,
  previewPurchase,
  getMinPrice,
  getSellerOrders,
  getTradeHistory,
  getListingHistory,
} from "./data/marketplace";
// ============================================================================
// DATA / VAULTS
// ============================================================================
export {
  getAllGardenVaults,
  getGardenVaults,
  getVaultDeposits,
  getVaultEvents,
} from "./data/vaults";
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
  isOfflineTxHash,
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
// LOGGING
// ============================================================================
export type { LogContext, Logger } from "./app/logger";
export { createLogger, logger } from "./app/logger";

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

// ============================================================================
// MARKETPLACE (HypercertExchange SDK integration)
// ============================================================================
export {
  // Client
  getMarketplaceClient,
  getMarketplaceAddresses,
  isMarketplaceSupported,
  resetMarketplaceClients,
  // Signing
  type MakerAskOrder,
  type ValidationResult,
  buildMakerAsk,
  signMakerAsk,
  validateOrder,
  // Approvals
  type MarketplaceApprovals,
  type EncodedApprovalCall,
  checkMarketplaceApprovals,
  buildApprovalTransactions,
} from "./marketplace";
