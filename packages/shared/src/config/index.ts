// Re-export all config organized by type - EXPLICIT EXPORTS for tree-shaking

// From app.ts
export {
  APP_DEFAULT_TITLE,
  APP_DESCRIPTION,
  APP_ICON,
  APP_NAME,
  APP_TITLE_TEMPLATE,
  APP_URL,
  ONBOARDED_STORAGE_KEY,
} from "./app";

// From appkit.ts
export {
  appKit,
  wagmiConfig,
} from "./appkit";

// From blockchain.ts
export type {
  EASConfig,
  NetworkConfig,
} from "./blockchain";
export {
  DEFAULT_CHAIN_ID,
  getDefaultChain,
  getEASConfig,
  getEasGraphqlUrl,
  getIndexerUrl,
  getNetworkConfig,
} from "./blockchain";
export type { SupportedChainId } from "./chains";
// From chains.ts
export {
  getChain,
  getChainName,
  isChainSupported,
  SUPPORTED_CHAINS,
} from "./chains";

// From pimlico.ts
export {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoApiKey,
  getPimlicoBundlerUrl,
  getPimlicoPaymasterUrl,
} from "./pimlico";

// From passkeyServer.ts (client-only passkey utilities)
export {
  createPasskey,
  getPasskeyRpId,
  isPasskeyAvailable,
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
} from "./passkeyServer";

// From react-query.ts
export { GC_TIMES, queryClient, STALE_TIMES } from "./react-query";
