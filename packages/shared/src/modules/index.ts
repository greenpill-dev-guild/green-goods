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
// AUTH / PASSKEY
// ============================================================================
export type { PasskeySession } from "./auth/passkey";
export {
  authenticatePasskey,
  clearStoredCredential,
  PASSKEY_STORAGE_KEY,
  recoverPasskeyAccount,
  registerPasskeySession,
  registerPasskeySessionWithENS,
  restorePasskeySession,
} from "./auth/passkey";

// ============================================================================
// AUTH / SESSION
// ============================================================================
export {
  // Storage keys
  AUTH_MODE_STORAGE_KEY,
  // Auth mode
  type AuthMode,
  getAuthMode,
  setAuthMode,
  clearAuthMode,
  // Passkey
  hasStoredPasskey,
  clearStoredPasskey,
  // Sign out
  clearAllAuth,
  // Legacy exports (deprecated but kept for backward compatibility)
  PASSKEY_SIGNED_OUT_KEY,
  SESSION_MARKER_KEY,
  SIGNED_OUT_KEY,
  getSavedAuthMode,
  saveAuthMode,
  hasStoredPasskeyCredential,
  clearAllAuthStorage,
  wasPasskeySignedOut,
  setPasskeySignedOut,
  clearPasskeySignedOut,
  isFreshAppStart,
  setWalletConnectIntent,
  consumeWalletConnectIntent,
  clearWalletConnectIntent,
  clearSignedOut,
  setSignedOut,
  wasExplicitlySignedOut,
  markSessionActive,
  checkAndHandleFreshStart,
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
// DATA / PINATA (IPFS)
// ============================================================================
export {
  getFileByHash,
  initializePinata,
  initializePinataFromEnv,
  resolveAvatarUrl,
  resolveImageUrl,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./data/pinata";

// ============================================================================
// DATA / URQL
// ============================================================================
export {
  createEasClient,
  createGreenGoodsIndexerClient,
  createIndexerClient,
  greenGoodsIndexer,
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
