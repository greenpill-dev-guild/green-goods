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
  normalizeAddress,
  truncateAddress,
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
  ActionRegistryABI,
  createClients,
  GardenAccountABI,
  GardenTokenABI,
  getNetworkContracts,
} from "./blockchain/contracts";
export type { ResolveEnsAddressOptions, ResolveEnsOptions } from "./blockchain/ens";
export { resolveEnsAddress, resolveEnsName } from "./blockchain/ens";
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
export { buildApprovalAttestTx, buildWorkAttestTx } from "./eas/transaction-builder";
// ============================================================================
// ERRORS
// ============================================================================
export type { ParsedContractError } from "./errors/contract-errors";
export {
  formatErrorForToast,
  isAlreadyGardenerError,
  isNotGardenerError, // @deprecated - use isNotGardenMemberError
  isNotGardenMemberError,
  parseAndFormatError,
  parseContractError,
} from "./errors/contract-errors";
export { extractErrorMessage, extractErrorMessageOr } from "./errors/extract-message";
export {
  formatJobError,
  formatUserError,
  formatWalletError,
  USER_FRIENDLY_ERRORS,
} from "./errors/user-messages";
export {
  normalizeFeedback,
  normalizePlantCount,
  normalizePlantSelection,
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
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  fromDateTimeLocalValue,
  getCurrentTimezone,
  getDurationMs,
  getStartOfDayUTC,
  getTimeCutoff,
  isTemporalSupported,
  normalizeTimestamp,
  sortByCreatedAt,
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
