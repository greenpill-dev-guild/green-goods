import type { OpsDeployRequest } from "@green-goods/shared";

export type OpsNetwork = OpsDeployRequest["network"];

export function chainIdToOpsNetwork(chainId: number): OpsNetwork {
  switch (chainId) {
    case 31337:
      return "localhost";
    case 1:
      return "mainnet";
    case 42161:
      return "arbitrum";
    case 42220:
      return "celo";
    case 11155111:
      return "sepolia";
    default:
      return "sepolia";
  }
}

export function getOpsStatusBadge(status: string): string {
  switch (status) {
    case "succeeded":
      return "text-success-base";
    case "failed":
      return "text-error-base";
    case "running":
      return "text-warning-base";
    default:
      return "text-text-soft";
  }
}
