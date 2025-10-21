import { createPimlicoClient } from "permissionless/clients/pimlico";
import { type Chain, createPublicClient, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { mainnet, sepolia } from "viem/chains";
import { getChain, isChainSupported } from "./chains";

// Pimlico API endpoints by chain
const PIMLICO_API_ENDPOINTS = {
  1: "https://api.pimlico.io/v2/1/rpc", // Mainnet
  11155111: "https://api.pimlico.io/v2/11155111/rpc", // Sepolia
  42161: "https://api.pimlico.io/v2/42161/rpc", // Arbitrum
  42220: "https://api.pimlico.io/v2/42220/rpc", // Celo
  84532: "https://api.pimlico.io/v2/84532/rpc", // Base Sepolia
} as const;

export function getPimlicoApiKey(): string {
  const apiKey = import.meta.env.VITE_PIMLICO_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_PIMLICO_API_KEY is not set. Please add it to your .env file.");
  }
  return apiKey;
}

export function getPimlicoBundlerUrl(chainId: number): string {
  const endpoint = PIMLICO_API_ENDPOINTS[chainId as keyof typeof PIMLICO_API_ENDPOINTS];
  if (!endpoint) {
    throw new Error(`Unsupported chain ID for Pimlico: ${chainId}`);
  }
  return `${endpoint}?apikey=${getPimlicoApiKey()}`;
}

export function getPimlicoPaymasterUrl(chainId: number): string {
  return getPimlicoBundlerUrl(chainId);
}

/**
 * Get chain for Pimlico clients
 * Uses SUPPORTED_CHAINS from chains.ts for core chains,
 * extends with additional test networks (mainnet, sepolia)
 */
function getPimlicoChain(chainId: number): Chain {
	// Use shared chain config for supported chains
	if (isChainSupported(chainId)) {
		return getChain(chainId);
	}
	
	// Extended chains for testing (not in SUPPORTED_CHAINS)
	switch (chainId) {
		case 1:
			return mainnet;
		case 11155111:
			return sepolia;
		default:
			throw new Error(`Unsupported chain ID for Pimlico: ${chainId}`);
	}
}

export function createPimlicoClientForChain(chainId: number) {
	const chain = getPimlicoChain(chainId);
  const bundlerUrl = getPimlicoBundlerUrl(chainId);

  return createPimlicoClient({
    transport: http(bundlerUrl),
    chain,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });
}

/**
 * Build Alchemy RPC URL for a given chain
 * Used by Pimlico public clients for optimal performance
 */
function buildAlchemyRpcUrl(chainId: number, chain: Chain): string {
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  
  if (!alchemyKey) {
    // No Alchemy key, use chain's default RPC
    return chain.rpcUrls.default.http[0];
  }
  
  // Build Alchemy RPC URL based on chain
  switch (chainId) {
    case 1: // Mainnet
      return `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 11155111: // Sepolia
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
    case 42161: // Arbitrum
      return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 42220: // Celo
      return `https://celo-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 84532: // Base Sepolia
      return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
    default:
      // Fallback to chain's default RPC
      return chain.rpcUrls.default.http[0];
  }
}

export function createPublicClientForChain(chainId: number) {
	const chain = getPimlicoChain(chainId);
  const rpcUrl = buildAlchemyRpcUrl(chainId, chain);

  return createPublicClient({
    transport: http(rpcUrl),
    chain,
  });
}
