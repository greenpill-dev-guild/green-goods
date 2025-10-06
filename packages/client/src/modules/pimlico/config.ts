import { createPimlicoClient } from "permissionless/clients/pimlico";
import { type Chain, createPublicClient, http } from "viem";
import { arbitrum, baseSepolia, celo } from "viem/chains";

// Pimlico API endpoints by chain
const PIMLICO_API_ENDPOINTS = {
  42161: "https://api.pimlico.io/v2/42161/rpc",
  42220: "https://api.pimlico.io/v2/42220/rpc",
  84532: "https://api.pimlico.io/v2/84532/rpc",
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

export function getChainFromId(chainId: number): Chain {
  switch (chainId) {
    case 42161:
      return arbitrum;
    case 42220:
      return celo;
    case 84532:
      return baseSepolia;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

export function createPimlicoClientForChain(chainId: number) {
  const chain = getChainFromId(chainId);
  const bundlerUrl = getPimlicoBundlerUrl(chainId);

  return createPimlicoClient({
    transport: http(bundlerUrl),
    chain,
  });
}

export function createPublicClientForChain(chainId: number) {
  const chain = getChainFromId(chainId);
  const rpcUrl = import.meta.env.VITE_ALCHEMY_API_KEY
    ? `https://${chain.name}.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`
    : chain.rpcUrls.default.http[0];

  return createPublicClient({
    transport: http(rpcUrl),
    chain,
  });
}
