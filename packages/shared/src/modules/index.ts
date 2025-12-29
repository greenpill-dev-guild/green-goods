// Modules — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// APP / ANALYTICS
// ============================================================================
export {
  getDistinctId,
  identify,
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
  USERNAME_STORAGE_KEY,
  PASSKEY_STORAGE_KEY,
  // Auth mode
  type AuthMode,
  clearAllAuth,
  clearAuthMode,
  getAuthMode,
  setAuthMode,
  // Username (Pimlico server)
  clearStoredUsername,
  getStoredUsername,
  hasStoredUsername,
  setStoredUsername,
  // Legacy (deprecated - credentials now on Pimlico server)
  clearStoredPasskey,
  hasStoredPasskey,
  // Legacy aliases (deprecated)
  clearAllAuthStorage,
  getSavedAuthMode,
  hasStoredPasskeyCredential,
  saveAuthMode,
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
  getFileByHash,
  initializeIpfs,
  initializeIpfsFromEnv,
  // Deprecated aliases for backward compatibility
  initializePinata,
  initializePinataFromEnv,
  // Storacha aliases (preferred naming)
  initializeStoracha,
  initializeStorachaFromEnv,
  resolveAvatarUrl,
  resolveImageUrl,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./data/ipfs";

// ============================================================================
// DATA / URQL
// ============================================================================
export {
  createEasClient,
  createGreenGoodsIndexerClient,
  createIndexerClient,
  greenGoodsIndexer,
  // Timeout utilities
  INDEXER_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from "./data/urql";

// ============================================================================
// JOB QUEUE
// ============================================================================
export {
  createOfflineTxHash,
  jobQueue,
  jobQueueDB,
  jobQueueEventBus,
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
