// Re-export all config organized by type - EXPLICIT EXPORTS for tree-shaking

// From app.ts
export {
  APP_NAME,
  APP_DEFAULT_TITLE,
  APP_TITLE_TEMPLATE,
  APP_DESCRIPTION,
  APP_URL,
  APP_ICON,
  ONBOARDED_STORAGE_KEY,
} from "./app";

// From appkit.ts
export {
  networks,
  wagmiAdapter,
  wagmiConfig,
  appKit,
} from "./appkit";

// From blockchain.ts
export type {
  EASConfig,
  NetworkConfig,
} from "./blockchain";
export {
  getEasGraphqlUrl,
  getEASConfig,
  getNetworkConfig,
  DEFAULT_CHAIN_ID,
  getDefaultChain,
  getIndexerUrl,
} from "./blockchain";

// From chains.ts
export {
  SUPPORTED_CHAINS,
  getChain,
  getChainName,
  isChainSupported,
} from "./chains";
export type { SupportedChainId } from "./chains";

// From pimlico.ts
export {
  getPimlicoApiKey,
  getPimlicoBundlerUrl,
  getPimlicoPaymasterUrl,
  createPimlicoClientForChain,
  createPublicClientForChain,
} from "./pimlico";

// From react-query.ts
export { queryClient } from "./react-query";
