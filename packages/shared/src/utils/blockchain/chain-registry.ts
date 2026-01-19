/**
 * Centralized Chain Registry
 *
 * Single source of truth for chain configurations across the application.
 * Consolidates chain ID mappings that were previously duplicated in
 * contracts.ts, explorers.ts, and other files.
 *
 * @module utils/blockchain/chain-registry
 */

export interface ChainConfig {
  /** Network name for deployment configs (e.g., "arbitrum", "baseSepolia") */
  name: string;
  /** EAS explorer subdomain name (e.g., "arbitrum-one", "base-sepolia") */
  easName: string;
  /** Block explorer base URL */
  blockExplorer: string;
  /** RPC URL template (use {ALCHEMY_KEY} placeholder) */
  rpcTemplate?: string;
}

/**
 * Chain registry mapping chain IDs to their configurations
 */
export const CHAIN_REGISTRY: Record<number, ChainConfig> = {
  // Mainnet chains
  1: {
    name: "mainnet",
    easName: "mainnet",
    blockExplorer: "https://etherscan.io",
    rpcTemplate: "https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },
  42161: {
    name: "arbitrum",
    easName: "arbitrum-one",
    blockExplorer: "https://arbiscan.io",
    rpcTemplate: "https://arb-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },
  42220: {
    name: "celo",
    easName: "celo",
    blockExplorer: "https://celoscan.io",
    rpcTemplate: "https://forno.celo.org",
  },
  10: {
    name: "optimism",
    easName: "optimism",
    blockExplorer: "https://optimistic.etherscan.io",
    rpcTemplate: "https://opt-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },
  137: {
    name: "polygon",
    easName: "polygon",
    blockExplorer: "https://polygonscan.com",
    rpcTemplate: "https://polygon-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },
  8453: {
    name: "base",
    easName: "base",
    blockExplorer: "https://basescan.org",
    rpcTemplate: "https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },

  // Testnet chains
  11155111: {
    name: "sepolia",
    easName: "sepolia",
    blockExplorer: "https://sepolia.etherscan.io",
    rpcTemplate: "https://eth-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },
  84532: {
    name: "baseSepolia",
    easName: "base-sepolia",
    blockExplorer: "https://sepolia.basescan.org",
    rpcTemplate: "https://base-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}",
  },

  // Local development
  31337: {
    name: "localhost",
    easName: "localhost",
    blockExplorer: "http://localhost:8545",
    rpcTemplate: "http://localhost:8545",
  },
} as const;

/**
 * Default chain configuration for unknown chain IDs
 */
export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  name: "baseSepolia",
  easName: "base-sepolia",
  blockExplorer: "https://sepolia.basescan.org",
  rpcTemplate: "https://base-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}",
};

/**
 * Get chain configuration by chain ID
 *
 * @param chainId - The chain ID to look up
 * @returns Chain configuration, or default config if chain ID is unknown
 */
export function getChainConfig(chainId: number): ChainConfig {
  return CHAIN_REGISTRY[chainId] ?? DEFAULT_CHAIN_CONFIG;
}

/**
 * Get the network name for a chain ID
 *
 * @param chainId - The chain ID to look up
 * @returns Network name (e.g., "arbitrum", "baseSepolia")
 */
export function getNetworkName(chainId: number): string {
  return getChainConfig(chainId).name;
}

/**
 * Get the EAS explorer name for a chain ID
 *
 * @param chainId - The chain ID to look up
 * @returns EAS explorer subdomain (e.g., "arbitrum-one", "base-sepolia")
 */
export function getEASName(chainId: number): string {
  return getChainConfig(chainId).easName;
}

/**
 * Get the block explorer base URL for a chain ID
 *
 * @param chainId - The chain ID to look up
 * @returns Block explorer URL (e.g., "https://arbiscan.io")
 */
export function getBlockExplorer(chainId: number): string {
  return getChainConfig(chainId).blockExplorer;
}

/**
 * Get the RPC URL for a chain ID
 *
 * @param chainId - The chain ID to look up
 * @param alchemyKey - Alchemy API key to substitute in the template
 * @returns RPC URL with the Alchemy key substituted
 */
export function getRpcUrl(chainId: number, alchemyKey: string = "demo"): string {
  const template = getChainConfig(chainId).rpcTemplate;
  if (!template) {
    return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }
  return template.replace("{ALCHEMY_KEY}", alchemyKey);
}

/**
 * Check if a chain ID is supported
 *
 * @param chainId - The chain ID to check
 * @returns True if the chain ID is in the registry
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_REGISTRY;
}
