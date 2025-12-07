/**
 * Admin Package Configuration
 *
 * Re-exports shared configurations and defines admin-specific constants.
 */
import { initializePinataFromEnv } from "@green-goods/shared/modules";

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

// Admin-specific config
export const ADMIN_NAME = "Green Goods Admin";
export const ADMIN_DESCRIPTION = "Garden management dashboard for Green Goods protocol";
