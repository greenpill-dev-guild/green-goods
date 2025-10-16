import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useToastAction } from "./useToastAction";
import { GardenAccountABI } from "@/utils/contracts";

export function useGardenOperations(gardenId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const addGardener = async (gardenerAddress: string) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "addGardener",
            account: address,
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
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "removeGardener",
            account: address,
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
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "addGardenOperator",
            account: address,
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
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "removeGardenOperator",
            account: address,
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
