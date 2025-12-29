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
export type { SimulationResult } from "./contract/simulation";
export { simulateJoinGarden, simulateTransaction } from "./contract/simulation";
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
export {
  formatJobError,
  formatUserError,
  formatWalletError,
  USER_FRIENDLY_ERRORS,
} from "./errors/user-messages";
// ============================================================================
// FORM STORAGE
// ============================================================================
export { clearFormDraft, loadFormDraft, saveFormDraft } from "./storage/form";
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
  toggle,
} from "./styles/theme";
// ============================================================================
// TIME
// ============================================================================
export type { TimeFilter } from "./time";
export {
  filterByTimeRange,
  formatRelativeTime,
  getTimeCutoff,
  sortByCreatedAt,
} from "./time";

// ============================================================================
// URQL
// ============================================================================
export { createUrqlClient } from "./urql";

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
