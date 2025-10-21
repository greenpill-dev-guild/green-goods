// Re-export all utils organized by domain - EXPLICIT EXPORTS for tree-shaking

// From app/recursive-clone-children.tsx
export { recursiveCloneChildren } from './app/recursive-clone-children';

// From app/tags.tsx
export { getTag } from './app/tags';

// From app/text.ts
export {
  formatAddress,
  truncate,
  isValidEmail,
  truncateDescription,
  formatPrice,
  formatLastUpdated,
  capitalize,
} from './app/text';

// From blockchain/chainId.ts
export {
  extractIdFromChainString,
  compareChainId,
} from './blockchain/chainId';

// From cn.ts
export { cn } from './cn';
export type { ClassValue } from './cn';

// From contracts.ts
export {
  GardenTokenABI,
  GardenAccountABI,
  ActionRegistryABI,
  getNetworkContracts,
  createClients,
} from './contracts';

// From debug.ts
export {
  DEBUG_ENABLED,
  debugLog,
  debugWarn,
  debugError,
} from './debug';

// From eas/encoders.ts
export { encodeWorkApprovalData } from './eas/encoders';

// From eas/explorers.ts
export {
  getEASExplorerUrl,
  openEASExplorer,
  isValidAttestationId,
} from './eas/explorers';

// From styles/polymorphic.ts
export type {
  PolymorphicRef,
  PolymorphicComponentPropsWithRef,
  PolymorphicComponentProps,
  PolymorphicComponent,
} from './styles/polymorphic';

// From urql.ts
export { createUrqlClient } from './urql';

// From work/image-compression.ts
export type {
  CompressionOptions,
  CompressionResult,
  CompressionStats,
} from './work/image-compression';
export {
  imageCompressor,
  formatFileSize,
  calculateCompressionRatio,
} from './work/image-compression';

// From work/workActions.ts
export type { WorkData } from './work/workActions';
export {
  downloadWorkData,
  getWorkShareUrl,
} from './work/workActions';

// Note: pinata functions exported from modules/data/pinata via modules/index.ts
