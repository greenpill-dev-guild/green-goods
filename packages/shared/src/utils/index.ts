// Utilities — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// ACTION
// ============================================================================
export {
  buildActionId,
  findActionByUID,
  getActionTitle,
  parseActionUID,
} from "./action/parsers";
export { defaultTemplate, instructionTemplates } from "./action/templates";
export {
  ACTION_INSTRUCTIONS_SCHEMA_VERSION,
  ACTION_TRANSLATION_LOCALES,
  buildActionInstructionsV2,
  createActionTranslationDraft,
  DEFAULT_ACTION_CONTENT_LOCALE,
  getActionSourceHash,
  getReviewedActionTranslation,
  hasActionTranslationContent,
  hasCompleteActionTranslationContent,
  isActionTranslationLocale,
  localizeAction,
  markStaleActionTranslations,
  normalizeActionTranslations,
} from "./action/translations";
// ============================================================================
// BROWSER
// ============================================================================
export type { BrowserInfo, MobileBrowser } from "./app/browser";
export {
  canTriggerInstallPrompt,
  detectMobileBrowser,
  getOpenInBrowserUrl,
  getRecommendedBrowser,
} from "./app/browser";
// ============================================================================
// APP
// ============================================================================
export { copyToClipboard } from "./app/clipboard";
export type { GardenMemberLike } from "./app/garden";
export {
  buildGardenMemberSets,
  gardenHasMember,
  resolveGardenMemberKey,
} from "./app/garden";
export {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarCampaigns,
  buildCampaignCookieJarMetadata,
  CAMPAIGN_COOKIE_JAR_PAYOUT_ASSET_IDS,
  CAMPAIGN_COOKIE_JAR_METADATA_KIND,
  deriveCampaignCookieJarClaimState,
  diffCampaignCookieJarAllowlist,
  getCampaignCookieJarPayoutAsset,
  getCampaignCookieJarPayoutAssets,
  getDefaultCampaignCookieJarPayoutAsset,
  normalizeCampaignAddress,
  normalizeCampaignMetadataUrl,
  parseCampaignAddressList,
  parseCampaignCookieJarFallbacks,
  parseCampaignCookieJarMetadata,
} from "./cookie-jar-campaign";
export type {
  CampaignCookieJarPayoutAsset,
  CampaignCookieJarPayoutAssetId,
} from "./cookie-jar-campaign";
export type {
  AdminCommunityRouteContext,
  AdminGardenRouteContext,
  AdminHubRouteContext,
  AdminSearchValue,
  AdminSignalPoolType,
  AdminWorkspaceId,
} from "./navigation/admin-routes";
export {
  ADMIN_GARDEN_SHARE_PARAM,
  ADMIN_WORKSPACE_ROOTS,
  adminRoutes,
  buildAdminHref,
  getAdminWorkspaceForPath,
  getAdminWorkspaceRoot,
} from "./navigation/admin-routes";
// ============================================================================
// HAPTIC FEEDBACK (Vibration API)
// ============================================================================
export {
  hapticError,
  hapticHeavy,
  hapticLight,
  hapticSelection,
  hapticSuccess,
  haptics,
  hapticWarning,
  isHapticsEnabled,
  isHapticsSupported,
  resetHapticsState,
  setHapticsEnabled,
} from "./app/haptics";
// ============================================================================
// FILES
// ============================================================================
export type { NormalizeToFileOptions } from "./app/normalizeToFile";
export { normalizeToFile } from "./app/normalizeToFile";
// ============================================================================
// PWA
// ============================================================================
export type { ClientPresentationMode, Platform } from "./app/pwa";
export {
  getClientPresentationMode,
  getMobileOperatingSystem,
  isAppInstalled,
  isLocalDevicePreviewMode,
  isMobilePlatform,
  isStandaloneMode,
} from "./app/pwa";
export type { InstallActionContext } from "./app/installAction";
export { dispatchInstallAction } from "./app/installAction";
export { recursiveCloneChildren } from "./app/recursive-clone-children";
export { getTag } from "./app/tags";
export type { FormatAddressOptions, FormatAddressVariant } from "./app/text";
export { capitalize, formatAddress, formatEnsNameForDisplay, truncate } from "./app/text";
// ============================================================================
// WAKE LOCK (Screen Wake Lock API)
// ============================================================================
export {
  isWakeLockSupported,
  releaseWakeLock,
  requestWakeLock,
  setupWakeLockVisibilityHandler,
  withWakeLock,
} from "./app/wake-lock";
export { AAVE_V3_POOL_ABI, formatApy, RAY, rayToApy } from "./blockchain/aave";
export {
  COOKIE_JAR_ABI,
  COOKIE_JAR_FACTORY_ABI,
  COOKIE_JAR_MODULE_ABI,
  DEPLOYMENT_REGISTRY_ABI,
  ERC20_ALLOWANCE_ABI,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
  GARDEN_ACCOUNT_ROLE_ABI,
  GARDENS_MODULE_ABI,
  YIELD_RESOLVER_ABI,
  OCTANT_MODULE_ABI,
  OCTANT_VAULT_ABI,
} from "./blockchain/abis";
// ============================================================================
// ADDRESS
// ============================================================================
export {
  compareAddresses,
  isAddressInList,
  isUserAddress,
  isValidAddressFormat,
  isZeroAddress,
  normalizeAddress,
  truncateAddress,
  ZERO_ADDRESS,
} from "./blockchain/address";
// ============================================================================
// CHAIN REGISTRY
// ============================================================================
export type { ChainConfig } from "./blockchain/chain-registry";
export {
  CHAIN_REGISTRY,
  DEFAULT_CHAIN_CONFIG,
  getBlockExplorer,
  getChainConfig,
  getEASName,
  getNetworkName,
  getRpcUrl,
  isChainSupported,
} from "./blockchain/chain-registry";
// ============================================================================
// CONTRACTS (ABIs & clients)
// ============================================================================
export {
  assertMarketplaceReady,
  ActionRegistryABI,
  createClients,
  deriveMarketplaceReadiness,
  formatMarketplaceReadinessError,
  GardenAccountABI,
  GardenTokenABI,
  GreenGoodsENSABI,
  getMarketplaceReadiness,
  getNetworkContracts,
  HatsABI,
  MARKETPLACE_READINESS_REQUIRED_FIELDS,
} from "./blockchain/contracts";
export type {
  ResolveEnsAddressOptions,
  ResolveEnsOptions,
  SlugValidationResult,
} from "./blockchain/ens";
export { resolveEnsAddress, resolveEnsName, suggestSlug, validateSlug } from "./blockchain/ens";
export type { GardenRole, RoleColorScheme } from "./blockchain/garden-roles";
export {
  annotateGardenSignalPools,
  deriveGardenYieldWiringState,
} from "./blockchain/garden-yield-wiring";
export type {
  GardenYieldWiringIssue,
  GardenYieldWiringReadStatus,
  GardenYieldWiringSnapshot,
  GardenYieldWiringState,
  GardenYieldWiringStatus,
} from "./blockchain/garden-yield-wiring";
export {
  GARDEN_ROLE_COLORS,
  GARDEN_ROLE_FUNCTIONS,
  GARDEN_ROLE_I18N_KEYS,
  GARDEN_ROLE_IDS,
  GARDEN_ROLE_ORDER,
  getRoleColorClasses,
  getRoleLabel,
  ROLE_COLOR_CLASSES,
} from "./blockchain/garden-roles";
// ============================================================================
// BLOCKCHAIN POLLING
// ============================================================================
export { pollQueriesAfterTransaction, pollQueryAfterTransaction } from "./blockchain/polling";
// ============================================================================
// CONTRACT
// ============================================================================
export type { SimulationResult } from "./blockchain/simulation";
export { simulateJoinGarden, simulateTransaction } from "./blockchain/simulation";
export {
  formatTokenAmount,
  AAVE_V3_POOL,
  DEFAULT_WITHDRAW_MAX_LOSS_BPS,
  getDepositLimitLabel,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  hasVaultAssetDecimals,
  isUnlimitedVaultLimit,
  isZeroBytes32,
  MAX_UINT256,
  normalizeDecimalInput,
  validateDecimalInput,
} from "./blockchain/vaults";
export {
  formatUsdCents,
  formatUsdPrice,
  getEthUsdFeedAddress,
  parseUsdToCents,
  PRICE_FEED_DECIMALS,
  PRICE_FEED_STALE_THRESHOLD_S,
  usdCentsToWei,
} from "./blockchain/price-feeds";
// ============================================================================
// COMPRESSION (Native Compression Streams API)
// ============================================================================
export type { CompressionFormat } from "./compression";
export {
  compress,
  compressJSON,
  decompress,
  decompressJSON,
  decompressResponse,
  getCompressionRatio,
  isCompressionSupported,
} from "./compression";
// ============================================================================
// DEBUG
// ============================================================================
export { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "./debug";
// ============================================================================
// DISPATCH ADAPTER
// ============================================================================
export { createDispatchAdapter } from "./dispatch-adapter";
// ============================================================================
// DOMAIN BITMASK
// ============================================================================
export { expandDomainMask, hasDomain } from "./domain";
// ============================================================================
// GARDEN DETAIL
// ============================================================================
export {
  aggregateBadges,
  DOMAIN_LABEL_IDS,
  getMedian,
  getSeverityRank,
  hoursSince,
  parseGardenDetailTab,
  parseGardenRange,
  RANGE_TO_MS,
  toMs,
} from "./garden-detail";
// ============================================================================
// EAS
// ============================================================================
export { encodeWorkApprovalData } from "./eas/encoders";
export {
  getBlockExplorerAddressUrl,
  getBlockExplorerTokenUrl,
  getBlockExplorerTxUrl,
  getEASExplorerUrl,
  isValidAttestationId,
  openBlockExplorerTx,
  openEASExplorer,
} from "./eas/explorers";
export {
  buildApprovalAttestTx,
  buildBatchWorkAttestTx,
  buildWorkAttestTx,
} from "./eas/transaction-builder";
export type { BlockchainErrorInfo, BlockchainErrorType } from "./errors/blockchain-errors";
export {
  detectBlockchainError,
  getBlockchainErrorAction,
  getBlockchainErrorI18nKey,
  isRecoverableBlockchainError,
} from "./errors/blockchain-errors";
export type {
  CategorizedError,
  ErrorCategory as CategorizedErrorCategory,
} from "./errors/categorize-error";
export { categorizeError } from "./errors/categorize-error";
// ============================================================================
// ERRORS
// ============================================================================
export type { ParsedContractError } from "./errors/contract-errors";
export {
  formatErrorForToast,
  isAlreadyGardenerError,
  isNotGardenMemberError,
  isWalletRequestExpiredError,
  parseAndFormatError,
  parseContractError,
} from "./errors/contract-errors";
export { extractErrorMessage, extractErrorMessageOr } from "./errors/extract-message";
export type {
  MutationErrorContext,
  MutationErrorHandlerConfig,
  MutationErrorResult,
} from "./errors/mutation-error-handler";
export {
  createDraftErrorHandler,
  createMutationErrorHandler,
} from "./errors/mutation-error-handler";
export type { TxErrorKind, TxErrorSeverity, TxErrorView } from "./errors/tx-error-classifier";
export {
  classifyTxError,
  isCancelledTxError,
  isMeaningfulTxErrorMessage,
} from "./errors/tx-error-classifier";
export { ValidationError } from "./errors/validation-error";
export {
  formatTimeSpent,
  normalizeFeedback,
  normalizePlantCount,
  normalizePlantSelection,
  normalizeTimeSpentMinutes,
} from "./form/normalizers";
// ============================================================================
// QUERY INVALIDATION
// ============================================================================
export type {
  InvalidationDelay,
  ProgressiveInvalidationOptions,
} from "../config/query-keys/schedule";
export {
  INVALIDATION_DELAYS,
  scheduleInvalidation,
  scheduleInvalidationForKey,
  scheduleProgressiveInvalidation,
} from "../config/query-keys/schedule";
// ============================================================================
// SCHEDULER (Native Scheduler API for cooperative multitasking)
// ============================================================================
export type { TaskPriority } from "./scheduler";
export {
  debounceWithScheduler,
  isSchedulerSupported,
  processBatched,
  runWhenIdle,
  scheduleTask,
  yieldToMain,
} from "./scheduler";
// ============================================================================
// FORM
// ============================================================================
export { clearFormDraft, loadFormDraft, saveFormDraft } from "./storage/form";
// ============================================================================
// STORAGE QUOTA
// ============================================================================
export type { StorageQuotaInfo, StorageQuotaThresholds } from "./storage/quota";
export {
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_LOW_THRESHOLD,
  formatBytes,
  getStorageQuota,
  hasEnoughStorage,
  isStorageQuotaSupported,
  trackStorageErrorWithQuota,
  trackStorageQuota,
} from "./storage/quota";
// ============================================================================
// CN (classnames utility)
// ============================================================================
export type { ClassValue } from "./styles/cn";
export { cn } from "./styles/cn";
// ============================================================================
// STYLES
// ============================================================================
export type {
  PolymorphicComponent,
  PolymorphicComponentProps,
  PolymorphicComponentPropsWithRef,
  PolymorphicRef,
} from "./styles/polymorphic";
export type { Resolved, Theme } from "./styles/theme";
export {
  getResolvedTheme,
  getTheme,
  initTheme,
  listenToSystemChanges,
  setTheme,
} from "./styles/theme";
// ============================================================================
// TIME (Temporal API with Date fallback)
// ============================================================================
export type { TimeFilter } from "./time";
export {
  // Temporal-specific utilities (2026)
  addDuration,
  compareTimestamps,
  // Core utilities (backward compatible)
  filterByTimeRange,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  fromDateInputValue,
  fromDateTimeLocalValue,
  getCurrentTimezone,
  getDurationMs,
  getStartOfDayUTC,
  getTimeCutoff,
  isTemporalSupported,
  normalizeTimestamp,
  sortByCreatedAt,
  toDateInputValue,
  toDateTimeLocalValue,
  toSafeDate,
  toSafeInstant,
} from "./time";
// ============================================================================
// WORK
// ============================================================================
export {
  deduplicateById,
  extractClientWorkId,
  mergeAndDeduplicateByClientId,
} from "./work/deduplication";
export type {
  CompressionOptions,
  CompressionResult,
  CompressionStats,
} from "./work/image-compression";
export {
  calculateCompressionRatio,
  formatFileSize,
  imageCompressor,
} from "./work/image-compression";
export { convertJobsToWorks, fetchOfflineWorks } from "./work/offline";
export type { WorkData } from "./work/workActions";
export { downloadWorkData, downloadWorkMedia, shareWork } from "./work/workActions";
