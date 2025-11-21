// Main entry point for @green-goods/shared
// EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// CONFIG
// ============================================================================
export {
  // app.ts
  APP_NAME,
  APP_DEFAULT_TITLE,
  APP_TITLE_TEMPLATE,
  APP_DESCRIPTION,
  APP_URL,
  APP_ICON,
  ONBOARDED_STORAGE_KEY,
  // appkit.ts
  networks,
  wagmiAdapter,
  wagmiConfig,
  appKit,
  // blockchain.ts
  getEasGraphqlUrl,
  getEASConfig,
  getNetworkConfig,
  DEFAULT_CHAIN_ID,
  getDefaultChain,
  getIndexerUrl,
  // chains.ts
  SUPPORTED_CHAINS,
  getChain,
  getChainName,
  isChainSupported,
  // pimlico.ts
  getPimlicoApiKey,
  getPimlicoBundlerUrl,
  getPimlicoPaymasterUrl,
  createPimlicoClientForChain,
  createPublicClientForChain,
  // react-query.ts
  queryClient,
} from "./config/index";

export type {
  EASConfig,
  NetworkConfig,
  SupportedChainId,
} from "./config/index";

// ============================================================================
// MODULES
// ============================================================================
export {
  // app/posthog.ts
  track,
  identify,
  reset,
  getDistinctId,
  trackOfflineEvent,
  trackSyncPerformance,
  trackAppLifecycle,
  // app/service-worker.ts
  serviceWorkerManager,
  // auth/passkey.ts
  PASSKEY_STORAGE_KEY,
  clearStoredCredential,
  recoverPasskeyAccount,
  registerPasskeySession,
  registerPasskeySessionWithENS,
  restorePasskeySession,
  // data/eas.ts
  getGardenAssessments,
  getWorks,
  getWorksByGardener,
  getWorkApprovals,
  // data/graphql.ts
  easGraphQL,
  greenGoodsGraphQL,
  // data/greengoods.ts
  Capital,
  getActions,
  getGardens,
  getGardeners,
  updateUserProfile,
  // data/pinata.ts
  initializePinata,
  resolveIPFSUrl,
  getFileByHash,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  // data/urql.ts
  createEasClient,
  createIndexerClient,
  createGreenGoodsIndexerClient,
  greenGoodsIndexer,
  // job-queue/index.ts
  createOfflineTxHash,
  jobQueue,
  jobQueueDB,
  jobQueueEventBus,
  useJobQueueEvents,
  // translation/
  browserTranslator,
  translationCache,
  // work/deduplication.ts - REMOVED (implementation missing)
  // DeduplicationManager,
  // defaultDeduplicationManager,
  // work/passkey-submission.ts
  submitWorkWithPasskey,
  submitApprovalWithPasskey,
  // work/work-submission.ts
  validateWorkDraft,
  validateApprovalDraft,
  getSubmissionStatusText,
  formatJobError,
} from "./modules/index";

export type {
  PasskeySession,
  FragmentOf,
  ResultOf,
  VariablesOf,
  PasskeyWorkSubmissionParams,
  PasskeyApprovalSubmissionParams,
} from "./modules/index";

// ============================================================================
// TYPES
// ============================================================================
export type {
  NetworkContracts,
  CreateGardenParams,
  DeploymentParams,
} from "./types/index";

// ============================================================================
// UTILITIES
// ============================================================================
export {
  // app/recursive-clone-children.tsx
  recursiveCloneChildren,
  // app/tags.tsx
  getTag,
  // app/text.ts
  formatAddress,
  truncate,
  isValidEmail,
  truncateDescription,
  formatPrice,
  formatLastUpdated,
  capitalize,
  // blockchain/chainId.ts
  extractIdFromChainString,
  compareChainId,
  // cn.ts
  cn,
  // contracts.ts
  GardenTokenABI,
  GardenAccountABI,
  ActionRegistryABI,
  getNetworkContracts,
  createClients,
  // debug.ts
  DEBUG_ENABLED,
  debugLog,
  debugWarn,
  debugError,
  // eas/encoders.ts
  encodeWorkApprovalData,
  // eas/explorers.ts
  getEASExplorerUrl,
  openEASExplorer,
  isValidAttestationId,
  // urql.ts
  createUrqlClient,
  // work/image-compression.ts
  imageCompressor,
  formatFileSize,
  calculateCompressionRatio,
  // work/workActions.ts
  downloadWorkData,
  getWorkShareUrl,
  // translation-diagnostics.ts
  runTranslationDiagnostics,
} from "./utils/index";

export type {
  ClassValue,
  PolymorphicRef,
  PolymorphicComponentPropsWithRef,
  PolymorphicComponentProps,
  PolymorphicComponent,
  CompressionOptions,
  CompressionResult,
  CompressionStats,
  WorkData,
} from "./utils/index";

// ============================================================================
// THEME
// ============================================================================
export {
  getTheme,
  setTheme,
  toggle,
  getResolvedTheme,
  initTheme,
} from "./theme";
export type { Theme, Resolved } from "./theme";

// ============================================================================
// TOAST
// ============================================================================
export { ToastViewport, toastService } from "./toast";
export type {
  ToastViewportProps,
  ToastDescriptor,
  ToastStatus,
  ToastAction,
} from "./toast";
