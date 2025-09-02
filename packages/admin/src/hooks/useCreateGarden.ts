import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { useToastAction } from "./useToastAction";
import { getNetworkContracts, GardenTokenABI, getChainById } from "@/utils/contracts";
import { useAdminStore } from "@/stores/admin";
import type { CreateGardenParams } from "@/types/contracts";

export function useCreateGarden() {
  const [isCreating, setIsCreating] = useState(false);
  const { executeWithToast } = useToastAction();
  const { selectedChainId } = useAdminStore();
  const { wallets } = useWallets();
  const wallet = wallets.find(w => w.walletClientType === "privy");

  const createGarden = async (params: CreateGardenParams) => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    setIsCreating(true);
    
    try {
      const contracts = getNetworkContracts(selectedChainId);
      
      const result = await executeWithToast(
        async () => {
          // Call mintGarden function on GardenToken contract
          const hash = await walletClient.writeContract({
            address: contracts.gardenToken as `0x${string}`,
            abi: GardenTokenABI.abi,
            functionName: "mintGarden",
            account: wallet.address as `0x${string}`,
            args: [
              params.communityToken,
              params.name,
              params.description,
              params.location,
              params.bannerImage,
              params.gardeners,
              params.gardenOperators,
            ],
          });

          return hash;
        },
        {
          loadingMessage: "Creating garden...",
          successMessage: `Garden "${params.name}" created successfully`,
          errorMessage: "Failed to create garden",
        }
      );

      return result;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createGarden,
    isCreating,
  };
}