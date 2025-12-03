/**
 * Client Package Configuration
 *
 * Re-exports shared configurations and defines client-specific constants.
 */
import { initializePinataFromEnv } from "@green-goods/shared";

// Initialize Pinata from environment
void initializePinataFromEnv(import.meta.env);

// Re-export shared configs (use relative path within monorepo)
export {
  DEFAULT_CHAIN_ID,
  getDefaultChain,
  getEASConfig,
  getIndexerUrl,
  getNetworkConfig,
} from "../../shared/src/config/blockchain";
export {
  getChain,
  getChainName,
  isChainSupported,
  SUPPORTED_CHAINS,
  type SupportedChainId,
} from "../../shared/src/config/chains";

// Client-specific config
export const CLIENT_NAME = "Green Goods";
export const CLIENT_DESCRIPTION = "Start Bringing Biodiversity Onchain";
export const CLIENT_URL = "https://greengoods.app";
export const CLIENT_ICON = "https://greengoods.app/icon.png";
