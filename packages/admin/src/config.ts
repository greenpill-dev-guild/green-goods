/**
 * Admin Package Configuration
 *
 * Re-exports shared configurations and defines admin-specific constants.
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize Storacha IPFS from environment
void initializeIpfsFromEnv(import.meta.env);

// Re-export shared configs using barrel exports
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
} from "@green-goods/shared";

// Admin-specific config
export const ADMIN_NAME = "Green Goods Admin";
export const ADMIN_DESCRIPTION = "Garden management dashboard for Green Goods protocol";
