import { createPimlicoClient } from "permissionless/clients/pimlico";
import { type Chain, createPublicClient, fallback, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { mainnet, sepolia } from "viem/chains";
import { ENV } from "../lib/env";
import { getRpcUrl } from "../utils/blockchain/chain-registry";
import { getChain, isChainSupported } from "./chains";

// Pimlico API endpoints by chain
const PIMLICO_API_ENDPOINTS = {
  1: "https://api.pimlico.io/v2/1/rpc", // Mainnet
  11155111: "https://api.pimlico.io/v2/11155111/rpc", // Sepolia
  42161: "https://api.pimlico.io/v2/42161/rpc", // Arbitrum
  42220: "https://api.pimlico.io/v2/42220/rpc", // Celo
  421614: "https://api.pimlico.io/v2/421614/rpc", // Arbitrum Sepolia mechanics profile
  11142220: "https://api.pimlico.io/v2/11142220/rpc", // Celo Sepolia mechanics profile
} as const;

const arbitrumSepoliaProfileChain = {
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [PIMLICO_API_ENDPOINTS[421614]] } },
} as const satisfies Chain;

const celoSepoliaProfileChain = {
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [PIMLICO_API_ENDPOINTS[11142220]] } },
} as const satisfies Chain;

/** The policy every chain takes unless the environment names another. */
const GENERAL_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

/**
 * One general policy covers every chain, Celo included. Celo may name its own
 * override; without one it takes the general policy exactly as Arbitrum does,
 * so a Celo send never waits on configuration that Arbitrum does not need.
 */
export function getPimlicoSponsorshipPolicyId(chainId: number): string {
  const celoOverride =
    chainId === 42220 ? ENV.VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID?.trim() : undefined;
  return (
    celoOverride || ENV.VITE_PIMLICO_SPONSORSHIP_POLICY_ID?.trim() || GENERAL_SPONSORSHIP_POLICY_ID
  );
}

export function getPimlicoApiKey(): string {
  const apiKey = ENV.VITE_PIMLICO_API_KEY;
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
    case 421614:
      return arbitrumSepoliaProfileChain;
    case 11142220:
      return celoSepoliaProfileChain;
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

export function createPublicClientForChain(chainId: number) {
  const chain = getPimlicoChain(chainId);
  const rpcUrl =
    chainId === 421614 || chainId === 11142220
      ? getPimlicoBundlerUrl(chainId)
      : getRpcUrl(chainId, ENV.VITE_ALCHEMY_API_KEY);

  const publicRpcUrl = getRpcUrl(chainId);
  return createPublicClient({
    transport:
      chainId === 42220 && rpcUrl !== publicRpcUrl
        ? fallback([http(rpcUrl), http(publicRpcUrl)])
        : http(rpcUrl),
    chain,
  });
}
