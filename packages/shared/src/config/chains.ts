import { arbitrum, baseSepolia, celo, type Chain } from "viem/chains";

export const SUPPORTED_CHAINS = {
	42161: arbitrum,
	84532: baseSepolia,
	42220: celo,
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export const getChain = (chainId: number): Chain => {
	return SUPPORTED_CHAINS[chainId as SupportedChainId] || baseSepolia;
};

export const getChainName = (chainId: number): string => {
	const names = {
		42161: "arbitrum",
		84532: "base-sepolia",
		42220: "celo",
	} as const;
	return names[chainId as SupportedChainId] || "unknown";
};

export const isChainSupported = (
	chainId: number,
): chainId is SupportedChainId => {
	return chainId in SUPPORTED_CHAINS;
};

