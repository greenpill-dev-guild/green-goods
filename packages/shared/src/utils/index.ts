// Re-export all utils organized by domain - EXPLICIT EXPORTS for tree-shaking

export { copyToClipboard } from "./app/clipboard";
export type { GardenMemberLike } from "./app/garden";
export {
  buildGardenMemberSets,
  gardenHasMember,
  resolveGardenMemberKey,
} from "./app/garden";
// From app/recursive-clone-children.tsx
export { recursiveCloneChildren } from "./app/recursive-clone-children";
// From app/tags.tsx
export { getTag } from "./app/tags";
// From app/text.ts
export {
  capitalize,
  type FormatAddressOptions,
  type FormatAddressVariant,
  formatAddress,
  formatLastUpdated,
  formatPrice,
  isValidEmail,
  truncate,
  truncateDescription,
} from "./app/text";

// From blockchain/chainId.ts
export {
  compareChainId,
  extractIdFromChainString,
} from "./blockchain/chainId";
export {
  type ResolveEnsAddressOptions,
  type ResolveEnsOptions,
  resolveEnsAddress,
  resolveEnsName,
} from "./blockchain/ens";
export type { ClassValue } from "./cn";
// From cn.ts
export { cn } from "./cn";
// From contracts.ts
export {
  ActionRegistryABI,
  createClients,
  GardenAccountABI,
  GardenTokenABI,
  getNetworkContracts,
} from "./contracts";
// From contract/simulation.ts
export {
  simulateTransaction,
  simulateJoinGarden,
  batchSimulate,
  type SimulationResult,
} from "./contract";
// From debug.ts
export {
  DEBUG_ENABLED,
  debugError,
  debugLog,
  debugWarn,
} from "./debug";

// From eas/encoders.ts
export { encodeWorkApprovalData } from "./eas/encoders";

// From eas/explorers.ts
export {
  getEASExplorerUrl,
  isValidAttestationId,
  openEASExplorer,
} from "./eas/explorers";
// From errors/contract-errors.ts
export {
  formatErrorForToast,
  isAlreadyGardenerError,
  isNotGardenerError,
  type ParsedContractError,
  parseAndFormatError,
  parseContractError,
  registerErrorSignature,
} from "./errors";
// From formStorage.ts
export {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from "./formStorage";
// From styles/polymorphic.ts
export type {
  PolymorphicComponent,
  PolymorphicComponentProps,
  PolymorphicComponentPropsWithRef,
  PolymorphicRef,
} from "./styles/polymorphic";
// From time.ts
export {
  filterByTimeRange,
  getTimeCutoff,
  normalizeTimestamp,
  sortByCreatedAt,
  type TimeFilter,
} from "./time";
// From translation-diagnostics.ts
export { runTranslationDiagnostics } from "./translation-diagnostics";
// From urql.ts
export { createUrqlClient } from "./urql";
// From work/deduplication.ts
export {
  deduplicateByFuzzyMatch,
  deduplicateById,
  extractClientWorkId,
  mergeAndDeduplicateByClientId,
} from "./work/deduplication";
// From work/image-compression.ts
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
// From work/offline.ts
export { convertJobsToWorks, fetchOfflineWorks } from "./work/offline";
// From work/workActions.ts
export type { WorkData } from "./work/workActions";
export {
  downloadWorkData,
  getWorkShareUrl,
} from "./work/workActions";
