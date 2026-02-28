import { arbitrum, celo, sepolia, type Chain } from "viem/chains";

export const SUPPORTED_CHAINS = {
  42161: arbitrum,
  11155111: sepolia,
  42220: celo,
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export const getChain = (chainId: number): Chain => {
  return SUPPORTED_CHAINS[chainId as SupportedChainId] || sepolia;
};

export const getChainName = (chainId: number): string => {
  const chain = SUPPORTED_CHAINS[chainId as SupportedChainId];
  return chain?.name || "Unknown";
};

export const isChainSupported = (chainId: number): chainId is SupportedChainId => {
  return chainId in SUPPORTED_CHAINS;
};
