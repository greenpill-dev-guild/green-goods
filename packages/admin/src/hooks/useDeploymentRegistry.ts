import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminStore } from "@/stores/admin";
import { getNetworkContracts, getChainById } from "@/utils/contracts";

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
  const { address, ready } = useAuth();
  const { selectedChainId } = useAdminStore();
  const [permissions, setPermissions] = useState<DeploymentRegistryPermissions>({
    isOwner: false,
    isInAllowlist: false,
    canDeploy: false,
    loading: true,
  });

  useEffect(() => {
    async function checkPermissions() {
      if (!address || !ready) {
        setPermissions({
          isOwner: false,
          isInAllowlist: false,
          canDeploy: false,
          loading: false,
        });
        return;
      }

      setPermissions((prev) => ({ ...prev, loading: true, error: undefined }));

      try {
        const contracts = getNetworkContracts(selectedChainId);
        const chain = getChainById(selectedChainId);

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

        const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";

        let rpcUrl = "";
        switch (selectedChainId) {
          case 42161: // Arbitrum
            rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
            break;
          case 42220: // Celo
            rpcUrl = "https://forno.celo.org";
            break;
          case 84532: // Base Sepolia
            rpcUrl = `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
            break;
          default:
            rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
        }

        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl),
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

        const isOwner = owner.toLowerCase() === address.toLowerCase();
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
  }, [address, ready, selectedChainId]);

  return permissions;
}
