// Re-export all modules organized by domain - EXPLICIT EXPORTS for tree-shaking

// From app/posthog.ts
export {
  track,
  identify,
  reset,
  getDistinctId,
  trackOfflineEvent,
  trackSyncPerformance,
  trackAppLifecycle,
} from "./app/posthog";

// From app/service-worker.ts
export { serviceWorkerManager } from "./app/service-worker";

// From auth/passkey.ts
export type { PasskeySession } from "./auth/passkey";
export {
  PASSKEY_STORAGE_KEY,
  authenticatePasskey,
  clearStoredCredential,
  recoverPasskeyAccount,
  registerPasskeySession,
  registerPasskeySessionWithENS,
  restorePasskeySession,
} from "./auth/passkey";

// From data/eas.ts
export {
  getGardenAssessments,
  getWorks,
  getWorksByGardener,
  getWorkApprovals,
} from "./data/eas";

// From data/graphql.ts
export {
  easGraphQL,
  greenGoodsGraphQL,
} from "./data/graphql";
export type { FragmentOf, ResultOf, VariablesOf } from "./data/graphql";

// From data/greengoods.ts
export {
  Capital,
  getActions,
  getGardens,
  getGardeners,
  updateUserProfile,
} from "./data/greengoods";

// From data/pinata.ts
export {
  initializePinata,
  getPinataClient,
  resolveIPFSUrl,
  getFileByHash,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./data/pinata";

// From data/urql.ts
export {
  createEasClient,
  createIndexerClient,
  createGreenGoodsIndexerClient,
  greenGoodsIndexer,
} from "./data/urql";

// From job-queue/index.ts
export {
  createOfflineTxHash,
  jobQueue,
  jobQueueDB,
  jobQueueEventBus,
  useJobQueueEvents,
} from "./job-queue";

// From translation/
export { browserTranslator } from "./translation/browser-translator";
export { translationCache } from "./translation/db";

// Note: work/deduplication.ts has been removed or is not yet implemented
// Tests exist but implementation is missing - commented out until implemented
// export type {
//   DuplicationConfig,
//   DuplicateCheckResult,
//   LocalDuplicateResult,
// } from './work/deduplication';
// export {
//   DeduplicationManager,
//   defaultDeduplicationManager,
// } from './work/deduplication';

// From work/passkey-submission.ts
export type {
  PasskeyWorkSubmissionParams,
  PasskeyApprovalSubmissionParams,
} from "./work/passkey-submission";
export {
  submitWorkWithPasskey,
  submitApprovalWithPasskey,
} from "./work/passkey-submission";

// From work/wallet-submission.ts (if exists)
// Note: wallet-submission.ts may not have public exports - verify

// From work/work-submission.ts
export {
  validateWorkDraft,
  validateApprovalDraft,
  getSubmissionStatusText,
  formatJobError,
} from "./work/work-submission";
