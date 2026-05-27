import { ENV } from "../lib/env";

export type LocalForkEnv = {
  VITE_DEV_CHAIN_MODE?: string;
  VITE_LOCAL_FORK_RPC_URL?: string;
};

export const LOCAL_ARBITRUM_FORK_CHAIN_ID = 42161;
export const LOCAL_ARBITRUM_FORK_MODE = "arbitrum_fork";
export const DEFAULT_LOCAL_ARBITRUM_FORK_RPC_URL = "http://127.0.0.1:3009";

export function isLocalArbitrumForkMode(env: LocalForkEnv = ENV): boolean {
  const mode = env.VITE_DEV_CHAIN_MODE?.trim().toLowerCase();
  return mode === LOCAL_ARBITRUM_FORK_MODE || mode === "arbitrum-fork";
}

export function getLocalArbitrumForkRpcUrl(env: LocalForkEnv = ENV): string {
  const configured = env.VITE_LOCAL_FORK_RPC_URL?.trim();
  return configured || DEFAULT_LOCAL_ARBITRUM_FORK_RPC_URL;
}

export function shouldUseLocalArbitrumForkRpc(
  chainId: number | string | undefined,
  env: LocalForkEnv = ENV
): boolean {
  return Number(chainId) === LOCAL_ARBITRUM_FORK_CHAIN_ID && isLocalArbitrumForkMode(env);
}
