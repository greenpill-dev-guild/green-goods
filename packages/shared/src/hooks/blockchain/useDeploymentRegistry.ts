import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { DEFAULT_CHAIN_ID, getNetworkConfig } from "../../config/blockchain";
import { useOptionalPasskeyAuth } from "../../providers/PasskeyAuth";
import { useOptionalWalletAuth } from "../../providers/WalletAuth";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { getChain, getNetworkContracts } from "../../utils/blockchain/contracts";

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
  const passkeyAuth = useOptionalPasskeyAuth();
  const walletAuth = useOptionalWalletAuth();

  const address =
    passkeyAuth?.smartAccountAddress ?? passkeyAuth?.walletAddress ?? walletAuth?.address ?? null;
  const ready = passkeyAuth ? passkeyAuth.isReady : (walletAuth?.ready ?? false);
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
        const contracts = getNetworkContracts(chainId);
        const chain = getChain(chainId);
        const networkConfig = getNetworkConfig(chainId);

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
