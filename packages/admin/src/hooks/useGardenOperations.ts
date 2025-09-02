import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { useToastAction } from "./useToastAction";
import { GardenAccountABI, getChainById } from "@/utils/contracts";
import { useAdminStore } from "@/stores/admin";

export function useGardenOperations(gardenId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { selectedChainId } = useAdminStore();
  const { wallets } = useWallets();
  const wallet = wallets.find(w => w.walletClientType === "privy");

  const addGardener = async (gardenerAddress: string) => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    setIsLoading(true);
    
    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "addGardener",
            account: wallet.address as `0x${string}`,
            args: [gardenerAddress],
          });

          return hash;
        },
        {
          loadingMessage: "Adding gardener...",
          successMessage: "Gardener added successfully",
          errorMessage: "Failed to add gardener",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const removeGardener = async (gardenerAddress: string) => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    setIsLoading(true);
    
    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "removeGardener",
            account: wallet.address as `0x${string}`,
            args: [gardenerAddress],
          });

          return hash;
        },
        {
          loadingMessage: "Removing gardener...",
          successMessage: "Gardener removed successfully",
          errorMessage: "Failed to remove gardener",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const addOperator = async (operatorAddress: string) => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    setIsLoading(true);
    
    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "addGardenOperator",
            account: wallet.address as `0x${string}`,
            args: [operatorAddress],
          });

          return hash;
        },
        {
          loadingMessage: "Adding operator...",
          successMessage: "Operator added successfully",
          errorMessage: "Failed to add operator",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const removeOperator = async (operatorAddress: string) => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    setIsLoading(true);
    
    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "removeGardenOperator",
            account: wallet.address as `0x${string}`,
            args: [operatorAddress],
          });

          return hash;
        },
        {
          loadingMessage: "Removing operator...",
          successMessage: "Operator removed successfully",
          errorMessage: "Failed to remove operator",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    addGardener,
    removeGardener,
    addOperator,
    removeOperator,
    isLoading,
  };
}