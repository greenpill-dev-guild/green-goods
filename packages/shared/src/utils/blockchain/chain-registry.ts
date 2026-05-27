/**
 * Centralized Chain Registry
 *
 * Single source of truth for chain configurations across the application.
 * Consolidates chain ID mappings that were previously duplicated in
 * contracts.ts, explorers.ts, and other files.
 *
 * @module utils/blockchain/chain-registry
 */

import {
  getLocalArbitrumForkRpcUrl,
  shouldUseLocalArbitrumForkRpc,
  type LocalForkEnv,
} from "../../config/local-fork";

export interface ChainConfig {
  /** Network name for deployment configs (e.g., "arbitrum", "sepolia") */
  name: string;
  /** EAS explorer subdomain name (e.g., "arbitrum-one", "sepolia") */
  easName: string;
  /** Block explorer base URL */
  blockExplorer: string;
  /** RPC URL template (use {ALCHEMY_KEY} placeholder) */
  rpcTemplate?: string;
  /** Public fallback RPC URL used when no provider key is configured */
  publicRpcUrl?: string;
}

const DEFAULT_PUBLIC_RPC_URL = "https://ethereum-sepolia.publicnode.com";

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
    publicRpcUrl: "https://ethereum-rpc.publicnode.com",
  },
  42161: {
    name: "arbitrum",
    easName: "arbitrum-one",
    blockExplorer: "https://arbiscan.io",
    rpcTemplate: "https://arb-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
    publicRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  42220: {
    name: "celo",
    easName: "celo",
    blockExplorer: "https://celoscan.io",
    rpcTemplate: "https://celo-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
    publicRpcUrl: "https://forno.celo.org",
  },
  10: {
    name: "optimism",
    easName: "optimism",
    blockExplorer: "https://optimistic.etherscan.io",
    rpcTemplate: "https://opt-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
    publicRpcUrl: "https://mainnet.optimism.io",
  },
  137: {
    name: "polygon",
    easName: "polygon",
    blockExplorer: "https://polygonscan.com",
    rpcTemplate: "https://polygon-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
    publicRpcUrl: "https://polygon-rpc.com",
  },
  // Testnet chains
  11155111: {
    name: "sepolia",
    easName: "sepolia",
    blockExplorer: "https://sepolia.etherscan.io",
    rpcTemplate: "https://eth-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}",
    publicRpcUrl: "https://ethereum-sepolia.publicnode.com",
  },
  // Local development
  31337: {
    name: "localhost",
    easName: "localhost",
    blockExplorer: "http://localhost:3009",
    rpcTemplate: "http://localhost:3009",
    publicRpcUrl: "http://localhost:3009",
  },
} as const;

/**
 * Default chain configuration for unknown chain IDs
 */
export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  name: "sepolia",
  easName: "sepolia",
  blockExplorer: "https://sepolia.etherscan.io",
  rpcTemplate: "https://eth-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}",
  publicRpcUrl: DEFAULT_PUBLIC_RPC_URL,
};

/** Returns the registered config, or DEFAULT_CHAIN_CONFIG if the chain is unknown. */
export function getChainConfig(chainId: number): ChainConfig {
  return CHAIN_REGISTRY[chainId] ?? DEFAULT_CHAIN_CONFIG;
}

export function getNetworkName(chainId: number): string {
  return getChainConfig(chainId).name;
}

export function getEASName(chainId: number): string {
  return getChainConfig(chainId).easName;
}

export function getBlockExplorer(chainId: number): string {
  return getChainConfig(chainId).blockExplorer;
}

/**
 * Get the RPC URL for a chain ID
 *
 * @param chainId - The chain ID to look up
 * @param alchemyKey - Alchemy API key to substitute in the template
 * @returns RPC URL with the provider key substituted, or a public fallback
 */
export function getRpcUrl(chainId: number, alchemyKey?: string, env?: LocalForkEnv): string {
  if (shouldUseLocalArbitrumForkRpc(chainId, env)) {
    return getLocalArbitrumForkRpcUrl(env);
  }

  const config = getChainConfig(chainId);
  const template = config.rpcTemplate;
  if (!template) {
    return config.publicRpcUrl ?? DEFAULT_PUBLIC_RPC_URL;
  }

  const normalizedKey = alchemyKey?.trim();
  const hasProviderKey = Boolean(normalizedKey && normalizedKey !== "demo");

  if (!hasProviderKey) {
    return config.publicRpcUrl ?? template;
  }

  return template.replace("{ALCHEMY_KEY}", normalizedKey!);
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
