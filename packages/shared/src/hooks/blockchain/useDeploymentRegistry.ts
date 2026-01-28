import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { useAccount } from "wagmi";
import { DEFAULT_CHAIN_ID, getNetworkConfig } from "../../config/blockchain";
import { useAuthContext } from "../../providers/Auth";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { getChain, getNetworkContracts } from "../../utils/blockchain/contracts";
import { logger } from "../../modules/app/logger";

// DeploymentRegistry ABI - only the functions we need
const DEPLOYMENT_REGISTRY_ABI = [
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
] as const;

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

  // Ready when either wagmi is connected OR auth context is authenticated
  const ready = isConnected || (auth.isReady && auth.isAuthenticated);

  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;
  const [permissions, setPermissions] = useState<DeploymentRegistryPermissions>({
    isOwner: false,
    isInAllowlist: false,
    canDeploy: false,
    loading: true,
  });

  useEffect(() => {
    async function checkPermissions() {
      // Keep loading=true when not ready - signals we haven't actually checked yet
      // This prevents race conditions where useRole sees loading=false before wagmi reconnects
      if (!address || !ready) {
        setPermissions({
          isOwner: false,
          isInAllowlist: false,
          canDeploy: false,
          loading: true,
        });
        return;
      }

      setPermissions((prev) => ({ ...prev, loading: true, error: undefined }));

      try {
        const contracts = getNetworkContracts(chainId);
        const chain = getChain(chainId);
        // Get Alchemy API key from environment to avoid CORS issues with demo endpoint
        const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
        const networkConfig = getNetworkConfig(chainId, alchemyKey);

        logger.debug("RPC config", {
          source: "useDeploymentRegistry",
          hasAlchemyKey: alchemyKey !== "demo",
          rpcHost: new URL(networkConfig.rpcUrl).hostname,
        });

        // If deployment registry is not configured, return false
        if (contracts.deploymentRegistry === "0x0000000000000000000000000000000000000000") {
          setPermissions({
            isOwner: false,
            isInAllowlist: false,
            canDeploy: false,
            loading: false,
          });
          return;
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

        setPermissions({
          isOwner,
          isInAllowlist,
          canDeploy,
          loading: false,
        });
      } catch (error) {
        console.error("Error checking deployment registry permissions:", error);
        setPermissions({
          isOwner: false,
          isInAllowlist: false,
          canDeploy: false,
          loading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    checkPermissions();
  }, [address, ready, chainId]);

  return permissions;
}
