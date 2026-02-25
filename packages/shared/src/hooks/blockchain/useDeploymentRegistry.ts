import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { useAccount } from "wagmi";
import { DEFAULT_CHAIN_ID, getNetworkConfig } from "../../config/blockchain";
import { STALE_TIMES } from "../../config/react-query";
import { useAuthContext } from "../../providers/Auth";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { Address } from "../../types/domain";
import { compareAddresses } from "../../utils/blockchain/address";
import { getChain, getNetworkContracts } from "../../utils/blockchain/contracts";
import { logger } from "../../modules/app/logger";
import { queryKeys } from "../query-keys";

// DeploymentRegistry ABI - read + write functions needed by hooks and views
export const DEPLOYMENT_REGISTRY_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isInAllowlist",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllowlist",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allowlistLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "addToAllowlist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "removeFromAllowlist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface DeploymentRegistryData {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
}

async function fetchDeploymentPermissions(
  address: string,
  chainId: number
): Promise<DeploymentRegistryData> {
  const contracts = getNetworkContracts(chainId);
  const chain = getChain(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
  const networkConfig = getNetworkConfig(chainId, alchemyKey);

  logger.debug("RPC config", {
    source: "useDeploymentRegistry",
    hasAlchemyKey: alchemyKey !== "demo",
    rpcHost: new URL(networkConfig.rpcUrl).hostname,
  });

  // If deployment registry is not configured, return false
  if (contracts.deploymentRegistry === "0x0000000000000000000000000000000000000000") {
    return { isOwner: false, isInAllowlist: false, canDeploy: false };
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.rpcUrl),
  });

  // Check if user is owner
  const owner = await publicClient.readContract({
    address: contracts.deploymentRegistry as `0x${string}`,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "owner",
  });

  // Check if user is in allowlist
  const isInAllowlist = await publicClient.readContract({
    address: contracts.deploymentRegistry as `0x${string}`,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "isInAllowlist",
    args: [address as `0x${string}`],
  });

  const isOwner = compareAddresses(owner, address);
  const canDeploy = isOwner || isInAllowlist;

  return { isOwner, isInAllowlist, canDeploy };
}

export interface DeploymentRegistryPermissions {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
  loading: boolean;
  error?: string;
}

export function useDeploymentRegistry(): DeploymentRegistryPermissions {
  const auth = useAuthContext();
  const { address: wagmiAddress, isConnected } = useAccount();

  // Get address - prioritize wagmi for wallet mode, then auth context (wallet or passkey)
  const address = wagmiAddress ?? auth.walletAddress ?? auth.smartAccountAddress ?? null;
  const normalizedAddress = address?.toLowerCase();

  // Ready when either wagmi is connected OR auth context is authenticated
  const ready = isConnected || (auth.isReady && auth.isAuthenticated);

  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.role.deploymentPermissions(normalizedAddress ?? undefined, chainId),
    queryFn: () => fetchDeploymentPermissions(normalizedAddress!, chainId),
    enabled: !!normalizedAddress && ready,
    staleTime: STALE_TIMES.baseLists,
    networkMode: "offlineFirst",
  });

  return {
    isOwner: data?.isOwner ?? false,
    isInAllowlist: data?.isInAllowlist ?? false,
    canDeploy: data?.canDeploy ?? false,
    loading: !ready || isLoading,
    ...(error ? { error: error instanceof Error ? error.message : "Unknown error" } : {}),
  };
}

// --- Allowlist query (gated by isOwner) ---

async function fetchDeploymentAllowlist(chainId: number): Promise<Address[]> {
  const contracts = getNetworkContracts(chainId);
  const chain = getChain(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
  const networkConfig = getNetworkConfig(chainId, alchemyKey);

  if (contracts.deploymentRegistry === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.rpcUrl),
  });

  const allowlist = await publicClient.readContract({
    address: contracts.deploymentRegistry as `0x${string}`,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "getAllowlist",
  });

  return allowlist as Address[];
}

export interface DeploymentAllowlistResult {
  allowlist: Address[];
  loading: boolean;
  error?: string;
}

export function useDeploymentAllowlist(enabled: boolean): DeploymentAllowlistResult {
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.role.allowlist(chainId),
    queryFn: () => fetchDeploymentAllowlist(chainId),
    enabled,
    staleTime: STALE_TIMES.baseLists,
    networkMode: "offlineFirst",
  });

  return {
    allowlist: data ?? [],
    loading: isLoading,
    ...(error ? { error: error instanceof Error ? error.message : "Unknown error" } : {}),
  };
}
