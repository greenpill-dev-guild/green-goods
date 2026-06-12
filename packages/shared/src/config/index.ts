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
  getAppKit,
  getWagmiConfig,
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
  isGreenWillDeployed,
} from "./blockchain";
export type { SupportedChainId } from "./chains";
// From chains.ts
export {
  getChain,
  getChainName,
  isChainSupported,
  SUPPORTED_CHAINS,
} from "./chains";
// From local-fork.ts
export type { LocalForkEnv } from "./local-fork";
export {
  DEFAULT_LOCAL_ARBITRUM_FORK_RPC_URL,
  getLocalArbitrumForkRpcUrl,
  isLocalArbitrumForkMode,
  LOCAL_ARBITRUM_FORK_CHAIN_ID,
  LOCAL_ARBITRUM_FORK_MODE,
  shouldUseLocalArbitrumForkRpc,
} from "./local-fork";
// From gardens-subgraph.ts
export { getGardensSubgraphUrl } from "./gardens-subgraph";

// From passkeyServer.ts (client-only passkey utilities)
export {
  buildPasskeyRecoveryContext,
  classifyPasskeyCeremonyContext,
  createPasskey,
  createPasskeyServerClient,
  getPasskeyRpId,
  isPasskeyAvailable,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
} from "./passkeyServer";
export type {
  PasskeyCeremonyBlockReason,
  PasskeyCeremonyContextStatus,
  PasskeyRecoveryContext,
} from "./passkeyServer";
// From pimlico.ts
export {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoApiKey,
  getPimlicoBundlerUrl,
  getPimlicoPaymasterUrl,
} from "./pimlico";
// From react-query.ts
export { GC_TIMES, queryClient, STALE_TIMES } from "./react-query";
export {
  createQueryPersister,
  createShouldDehydrateQuery,
  PERSIST_MAX_AGE,
  type CreateQueryPersisterOptions,
  type CreateShouldDehydrateQueryOptions,
} from "./query-persistence";

// From sdg.ts
export type { SDGGoalId, SDGTarget } from "./sdg";
export { getSDGLabel, SDG_TARGETS } from "./sdg";

// From domain.ts
export type { DomainStyle } from "./domain";
export { DOMAIN_CONFIG } from "./domain";
