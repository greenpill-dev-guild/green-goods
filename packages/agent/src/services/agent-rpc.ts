import { getNetworkConfig } from "@green-goods/shared";

export type AgentRpcEnv = Pick<
  NodeJS.ProcessEnv,
  | "ETHEREUM_RPC_URL"
  | "SEPOLIA_RPC_URL"
  | "ARBITRUM_RPC_URL"
  | "CELO_RPC_URL"
  | "OPTIMISM_RPC_URL"
  | "VITE_RPC_URL_11155111"
  | "ALCHEMY_API_KEY"
  | "ALCHEMY_KEY"
>;

const CHAIN_RPC_ENV: Record<number, keyof AgentRpcEnv> = {
  1: "ETHEREUM_RPC_URL",
  11155111: "SEPOLIA_RPC_URL",
  42161: "ARBITRUM_RPC_URL",
  42220: "CELO_RPC_URL",
  10: "OPTIMISM_RPC_URL",
};

export function resolveAgentRpcUrl(chainId: number, env: AgentRpcEnv = process.env): string {
  const chainSpecific = CHAIN_RPC_ENV[chainId];
  if (chainSpecific && env[chainSpecific]) return env[chainSpecific] as string;
  if (chainId === 11155111 && env.VITE_RPC_URL_11155111) return env.VITE_RPC_URL_11155111;

  const alchemyKey = env.ALCHEMY_API_KEY || env.ALCHEMY_KEY || "demo";
  return getNetworkConfig(chainId, alchemyKey).rpcUrl;
}
