import { Addresses } from "../v3";

export const CHAINS = {
  arbitrum: 42161,
  celo: 42220,
  sepolia: 11155111,
} as const;

export function addr(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString().padStart(40, "0")}`;
}

export function txHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

export function mockEvent(
  chainId: number,
  timestamp: number,
  options: {
    srcAddress?: string;
    txHash?: string;
    logIndex?: number;
    blockNumber?: number;
  } = {}
) {
  return {
    chainId,
    block: { timestamp, number: options.blockNumber ?? 0 },
    srcAddress: options.srcAddress,
    transaction: { hash: options.txHash ?? txHash(timestamp) },
    logIndex: options.logIndex,
  };
}
