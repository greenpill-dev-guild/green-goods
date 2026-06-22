// Modules — EXPLICIT EXPORTS for tree-shaking

export {
  ANALYTICS_EVENTS,
  trackAdminActionCreateFailed,
  // Admin: action events
  trackAdminActionCreateStarted,
  trackAdminActionCreateSuccess,
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
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestFailed,
  trackWorkWalletRequestStarted,
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
// LOGGING
// ============================================================================
export type { LogContext, Logger } from "./app/logger";
export { createLogger, logger } from "./app/logger";
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
  // Auth mode
  type AuthMode,
  clearAllAuth,
  clearAuthMode,
  clearStoredRpId,
  // Username (Pimlico server)
  clearStoredUsername,
  clearStoredSmartAccountAddress,
  // Signed-out sentinel (explicit sign-out durability)
  clearSignedOutSentinel,
  getAuthMode,
  getStoredSmartAccountAddress,
  getStoredUsername,
  hasSignedOutSentinel,
  hasStoredUsername,
  // RP ID (Android passkey compatibility)
  RP_ID_STORAGE_KEY,
  SIGNED_OUT_STORAGE_KEY,
  SMART_ACCOUNT_ADDRESS_STORAGE_KEY,
  setAuthMode,
  setSignedOutSentinel,
  setStoredSmartAccountAddress,
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
  withTimeout,
} from "./data/graphql-client";
// ============================================================================
// DATA / GREENGOODS
// ============================================================================
export {
  getCampaignCookieJarCampaigns,
  getCampaignCookieJarTrustedCreators,
  getIndexedCampaignCookieJars,
} from "./data/campaign-cookie-jars";
export {
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
// DATA / IPFS
// ============================================================================
export {
  // Upload context types
  type FileUploadContext,
  getFileByHash,
  getIPFSFallbackGateways,
  getIpfsInitStatus,
  initializeIpfs,
  initializeIpfsFromEnv,
  IPFS_FALLBACK_GATEWAYS,
  type JsonUploadContext,
  resolveAvatarUrl,
  resolveImageUrl,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./data/ipfs";
// ============================================================================
// DATA / MARKETPLACE (On-chain reads & event queries)
// ============================================================================
export {
  getActiveOrder,
  getListingHistory,
  getMinPrice,
  getRegisteredOrders,
  getSellerOrders,
  getTradeHistory,
  previewPurchase,
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
// VAULT CROWDFUNDING
// ============================================================================
export {
  createOctantVaultWalletEndowReceiver,
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  getOctantVaultCampaignBySlug,
  getOctantVaultAssetDisplayPolicy,
  hasRequiredOctantVaultFundingBalance,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaignCopyMessageIds,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  isOctantVaultCampaignTransactionReady,
  meetsOctantVaultCardEndowUsdMinimum,
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS,
  OCTANT_VAULT_CAMPAIGN_MANIFEST,
  OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS,
  OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS,
  OCTANT_VAULT_MANIFEST_FIELD_LABELS,
  OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
  prepareOctantVaultCardEndowFallbackPlan,
  prepareOctantVaultCardEndowReadiness,
  prepareOctantVaultWalletEndow,
  validateOctantVaultCardEndowManifest,
  validateOctantVaultCardEndowProof,
  validateOctantVaultCardEndowReceiver,
  validateOctantVaultCardOnrampCompletion,
  validateOctantVaultCardOnrampQuote,
  validateOctantVaultCampaignManifest,
  validateOctantVaultRouteManageProof,
  validateOctantVaultShareOwnershipProof,
} from "./vault-crowdfunding";
export type {
  OctantVaultCardDonateIntentKind,
  OctantVaultCardDonateProof,
  OctantVaultCardOnrampCompletionError,
  OctantVaultCardOnrampCompletionExpectation,
  OctantVaultCardOnrampCompletionInput,
  OctantVaultCardOnrampCompletionValidation,
  OctantVaultCardOnrampQuoteError,
  OctantVaultCardOnrampQuoteInput,
  OctantVaultCardOnrampQuoteValidation,
  OctantVaultCardOnrampRouteExpectation,
  OctantVaultCardEndowIntentKind,
  OctantVaultCardEndowProof,
  OctantVaultCardEndowProofExpectation,
  OctantVaultCardEndowProofInput,
  OctantVaultCardEndowProofValidation,
  OctantVaultCardEndowProofValidationError,
  OctantVaultCardEndowFallbackApprovalTransaction,
  OctantVaultCardEndowFallbackDepositTransaction,
  OctantVaultCardEndowFallbackFundingStep,
  OctantVaultCardEndowFallbackPlan,
  OctantVaultCardEndowFallbackPlanError,
  OctantVaultCardEndowFallbackPlanInput,
  OctantVaultCardEndowFallbackPreparation,
  OctantVaultCardEndowFallbackReceiptExpectation,
  OctantVaultCardEndowFallbackShareVerification,
  OctantVaultCardEndowFallbackTransactionRole,
  OctantVaultCardEndowFallbackUserTransaction,
  OctantVaultCardEndowReadiness,
  OctantVaultCardEndowReadinessError,
  OctantVaultCardEndowReadinessInput,
  OctantVaultCardEndowReceiver,
  OctantVaultCardEndowReceiverCustody,
  OctantVaultCardEndowReceiverInput,
  OctantVaultCardEndowReceiverValidation,
  OctantVaultCardEndowReceiverValidationError,
  OctantVaultCardEndowTuple,
  OctantVaultCardProof,
  OctantVaultCardProofAsset,
  OctantVaultCardProofIntentKind,
  OctantVaultCardProvider,
  OctantVaultCampaignAssetManifest,
  OctantVaultCampaignCopy,
  OctantVaultCampaignCopyField,
  OctantVaultCampaignCopyMessageIds,
  OctantVaultCampaignFixtureRole,
  OctantVaultCampaignManifest,
  OctantVaultCampaignManifestStatus,
  OctantVaultCampaignManifestValidation,
  OctantVaultCampaignSlug,
  OctantVaultCampaignTargetProtocol,
  OctantVaultCampaignTransactionState,
  OctantVaultEndowReceiver,
  KnownOctantVaultCampaignSlug,
  OctantVaultManifest,
  OctantVaultManifestField,
  OctantVaultManifestFieldLabelMessageIds,
  OctantVaultPaymentMethod,
  OctantVaultRouteManageProofError,
  OctantVaultRouteManageProofInput,
  OctantVaultRouteManageProofValidation,
  OctantVaultShareOwnershipProofError,
  OctantVaultShareOwnershipProofInput,
  OctantVaultShareOwnershipProofValidation,
  OctantVaultStrategyFactoryEvidence,
  OctantVaultYieldSource,
  OctantVaultYieldSourceKind,
  OctantVaultTransactionHash,
  OctantVaultWalletEndowPreparation,
  OctantVaultWalletEndowPreparationError,
  OctantVaultWalletEndowPreparationInput,
  OctantVaultWalletEndowPreparedTransaction,
  OctantVaultWalletEndowIntentKind,
  OctantVaultWalletEndowReceiver,
} from "./vault-crowdfunding";
export {
  forgetOctantVaultCardWalletPositions,
  getOctantVaultCardWalletOwners,
  getOctantVaultCardWalletPositionRefs,
  getOctantVaultPendingFundedCardWalletRefs,
  rememberOctantVaultCardWalletPosition,
} from "./octant-vault-card-wallet-cache";
export type {
  OctantVaultCardWalletPositionRef,
  OctantVaultCardWalletPositionStatus,
} from "./octant-vault-card-wallet-cache";
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
// MARKETPLACE (HypercertExchange SDK integration)
// ============================================================================
export {
  buildApprovalTransactions,
  buildMakerAsk,
  checkMarketplaceApprovals,
  type EncodedApprovalCall,
  getMarketplaceAddresses,
  // Client
  getMarketplaceClient,
  isMarketplaceSupported,
  // Signing
  type MakerAskOrder,
  // Approvals
  type MarketplaceApprovals,
  resetMarketplaceClients,
  signMakerAsk,
  type ValidationResult,
  validateOrder,
} from "./marketplace";
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
// WORK / MEDIA PROCESSING
// ============================================================================
export type {
  AcceptedWorkMediaFile,
  ConvertedWorkMediaFile,
  MediaRejectedReason,
  RejectedWorkMediaFile,
  SafeMediaMetadata,
  WorkMediaKind,
  WorkMediaProcessingResult,
  WorkMediaSource,
} from "./work/media-processing";
export {
  getFileExtension,
  getMediaKind,
  getSafeMediaBatchMetadata,
  getSafeMediaMetadata,
  getSizeBucket,
  getWorkMediaId,
  HEIC_JPEG_QUALITY,
  isVideoFile,
  normalizeWorkMediaFiles,
} from "./work/media-processing";
// ============================================================================
// TRANSACTIONS
// ============================================================================
export type {
  ContractCall,
  TransactionSender,
  TransactionSenderOptions,
  TxResult,
} from "./transactions";
export {
  createTransactionSender,
  EmbeddedSender,
  PasskeySender,
  WalletSender,
} from "./transactions";
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
// WORK / WALLET SUBMISSION
// ============================================================================
export type { WalletSubmissionOptions } from "./work/wallet-submission";
export { submitWorkDirectly } from "./work/wallet-submission";
// ============================================================================
// WORK / WORK SUBMISSION
// ============================================================================
export {
  getSubmissionStatusText,
  validateApprovalDraft,
  validateWorkSubmissionContext,
} from "./work/work-submission";
