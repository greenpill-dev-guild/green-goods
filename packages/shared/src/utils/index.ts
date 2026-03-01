// Utilities — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// DOMAIN BITMASK
// ============================================================================
export { expandDomainMask, hasDomain } from "./domain";
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
// ============================================================================
// APP
// ============================================================================
export { copyToClipboard } from "./app/clipboard";
export type { GardenMemberLike } from "./app/garden";
// ============================================================================
// HAPTIC FEEDBACK (Vibration API)
// ============================================================================
export {
  hapticError,
  hapticHeavy,
  hapticLight,
  haptics,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
  isHapticsEnabled,
  isHapticsSupported,
  resetHapticsState,
  setHapticsEnabled,
} from "./app/haptics";
export {
  buildGardenMemberSets,
  gardenHasMember,
  resolveGardenMemberKey,
} from "./app/garden";
// ============================================================================
// FILES
// ============================================================================
export type { NormalizeToFileOptions } from "./app/normalizeToFile";
export { normalizeToFile } from "./app/normalizeToFile";
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
// PWA
// ============================================================================
export type { Platform } from "./app/pwa";
export {
  getMobileOperatingSystem,
  isAppInstalled,
  isMobilePlatform,
  isStandaloneMode,
} from "./app/pwa";
export { recursiveCloneChildren } from "./app/recursive-clone-children";
export { getTag } from "./app/tags";
export type { FormatAddressOptions, FormatAddressVariant } from "./app/text";
export { capitalize, formatAddress, truncate } from "./app/text";
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
} from "./blockchain/address";
export {
  GARDEN_ROLE_COLORS,
  GARDEN_ROLE_FUNCTIONS,
  GARDEN_ROLE_I18N_KEYS,
  GARDEN_ROLE_IDS,
  GARDEN_ROLE_ORDER,
  getRoleColorClasses,
  ROLE_COLOR_CLASSES,
} from "./blockchain/garden-roles";
export type { GardenRole, RoleColorScheme } from "./blockchain/garden-roles";
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
export {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  hasVaultAssetDecimals,
  isZeroAddressValue,
  isZeroBytes32,
  validateDecimalInput,
  ZERO_ADDRESS,
} from "./blockchain/vaults";
// ============================================================================
// CONTRACTS (ABIs & clients)
// ============================================================================
export {
  ActionRegistryABI,
  createClients,
  GardenAccountABI,
  GardenTokenABI,
  GreenGoodsENSABI,
  HatsABI,
  getNetworkContracts,
} from "./blockchain/contracts";
export { GARDEN_ACCOUNT_ROLE_ABI, OCTANT_MODULE_ABI } from "./blockchain/abis";
export type { ResolveEnsAddressOptions, ResolveEnsOptions } from "./blockchain/ens";
export { resolveEnsAddress, resolveEnsName, suggestSlug, validateSlug } from "./blockchain/ens";
export type { SlugValidationResult } from "./blockchain/ens";
// ============================================================================
// BLOCKCHAIN POLLING
// ============================================================================
export { pollQueriesAfterTransaction, pollQueryAfterTransaction } from "./blockchain/polling";
// ============================================================================
// CONTRACT
// ============================================================================
export type { SimulationResult } from "./blockchain/simulation";
export { simulateJoinGarden, simulateTransaction } from "./blockchain/simulation";
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
// EAS
// ============================================================================
export { encodeWorkApprovalData } from "./eas/encoders";
export {
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
// ============================================================================
// ERRORS
// ============================================================================
export type { ParsedContractError } from "./errors/contract-errors";
export {
  formatErrorForToast,
  isAlreadyGardenerError,
  isNotGardenMemberError,
  parseAndFormatError,
  parseContractError,
} from "./errors/contract-errors";
export type { TxErrorKind, TxErrorSeverity, TxErrorView } from "./errors/tx-error-classifier";
export {
  classifyTxError,
  isCancelledTxError,
  isMeaningfulTxErrorMessage,
} from "./errors/tx-error-classifier";
export type {
  CategorizedError,
  ErrorCategory as CategorizedErrorCategory,
} from "./errors/categorize-error";
export { categorizeError } from "./errors/categorize-error";
export type {
  MutationErrorHandlerConfig,
  MutationErrorContext,
  MutationErrorResult,
} from "./errors/mutation-error-handler";
export { createMutationErrorHandler, createDraftErrorHandler } from "./errors/mutation-error-handler";
export { extractErrorMessage, extractErrorMessageOr } from "./errors/extract-message";
export {
  formatJobError,
  formatUserError,
  formatWalletError,
  USER_FRIENDLY_ERRORS,
} from "./errors/user-messages";
export { ValidationError } from "./errors/validation-error";
export type { BlockchainErrorInfo, BlockchainErrorType } from "./errors/blockchain-errors";
export {
  detectBlockchainError,
  getBlockchainErrorAction,
  getBlockchainErrorI18nKey,
  isRecoverableBlockchainError,
} from "./errors/blockchain-errors";
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
export type { InvalidationDelay, ProgressiveInvalidationOptions } from "./query-invalidation";
export {
  INVALIDATION_DELAYS,
  scheduleInvalidation,
  scheduleInvalidationForKey,
  scheduleProgressiveInvalidation,
} from "./query-invalidation";
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
