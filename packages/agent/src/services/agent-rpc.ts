import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import {
  getLocalArbitrumForkRpcUrl,
  type LocalForkEnv,
  shouldUseLocalArbitrumForkRpc,
} from "@green-goods/shared/config/local-fork";
import { arbitrum, celo, mainnet, optimism, sepolia } from "viem/chains";

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
> &
  LocalForkEnv;

const CHAIN_RPC_ENV: Record<number, keyof AgentRpcEnv> = {
  1: "ETHEREUM_RPC_URL",
  11155111: "SEPOLIA_RPC_URL",
  42161: "ARBITRUM_RPC_URL",
  42220: "CELO_RPC_URL",
  10: "OPTIMISM_RPC_URL",
};

/** Each chain's own public endpoint: rate limited, but it answers without a key. */
const PUBLIC_RPC: Record<number, string | undefined> = Object.fromEntries(
  [mainnet, sepolia, arbitrum, celo, optimism].map((chain) => [
    chain.id,
    chain.rpcUrls.default.http[0],
  ])
);

export interface AgentRpc {
  url: string;
  /**
   * Where the address came from: the chain's own setting, a local fork, the Alchemy key, or the
   * chain's public endpoint because none of them is set.
   */
  source: "configured" | "fork" | "alchemy" | "public";
}

/**
 * The RPC address the Agent reads a chain through. A chain's own address wins, then the Alchemy
 * key. With neither, the Agent uses the chain's public endpoint: Alchemy's keyless `demo` address
 * refuses requests, and an Agent that cannot read the chain can neither list a garden's activities
 * nor verify an account.
 */
export function resolveAgentRpc(chainId: number, env: AgentRpcEnv = process.env): AgentRpc {
  const chainSpecific = CHAIN_RPC_ENV[chainId];
  if (chainSpecific && env[chainSpecific]) {
    return { url: env[chainSpecific] as string, source: "configured" };
  }
  if (chainId === 11155111 && env.VITE_RPC_URL_11155111) {
    return { url: env.VITE_RPC_URL_11155111, source: "configured" };
  }
  // A local fork stands in for the chain: reading the public one would bypass it.
  if (shouldUseLocalArbitrumForkRpc(chainId, env)) {
    return { url: getLocalArbitrumForkRpcUrl(env), source: "fork" };
  }
  const alchemyKey = env.ALCHEMY_API_KEY || env.ALCHEMY_KEY;
  if (alchemyKey) return { url: getNetworkConfig(chainId, alchemyKey).rpcUrl, source: "alchemy" };
  // A chain with no public endpoint listed here is a local one, whose address carries no key.
  return { url: PUBLIC_RPC[chainId] ?? getNetworkConfig(chainId).rpcUrl, source: "public" };
}

/**
 * The part of an RPC address that is safe to log: its host. The path can carry a provider key,
 * and a setting that is not an address at all must not stop the Agent from starting.
 */
export function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "not a readable address";
  }
}

export function resolveAgentRpcUrl(chainId: number, env: AgentRpcEnv = process.env): string {
  return resolveAgentRpc(chainId, env).url;
}
