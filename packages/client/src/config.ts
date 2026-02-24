/**
 * Client Package Configuration
 *
 * Re-exports shared configurations and defines client-specific constants.
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize Storacha IPFS from environment
void initializeIpfsFromEnv(import.meta.env);

// Re-export shared configs from barrel
export {
  DEFAULT_CHAIN_ID,
  getDefaultChain,
  getEASConfig,
  getIndexerUrl,
  getNetworkConfig,
  getChain,
  getChainName,
  isChainSupported,
  SUPPORTED_CHAINS,
  type SupportedChainId,
} from "@green-goods/shared";

// Client-specific config
export const CLIENT_NAME = "Green Goods";
export const CLIENT_DESCRIPTION = "Start Bringing Your Impact Onchain";
export const CLIENT_URL = "https://greengoods.app";
export const CLIENT_ICON = "https://greengoods.app/icon.png";
