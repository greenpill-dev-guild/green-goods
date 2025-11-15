import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useToastAction } from "../app/useToastAction";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/contracts";
import { Capital } from "../../modules/data/greengoods";

export function useActionOperations(chainId: number) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const contracts = getNetworkContracts(chainId);

  const registerAction = async (params: {
    startTime: number;
    endTime: number;
    title: string;
    instructions: string;
    capitals: Capital[];
    media: string[];
  }) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "registerAction",
            account: address,
            args: [
              BigInt(params.startTime),
              BigInt(params.endTime),
              params.title,
              params.instructions,
              params.capitals,
              params.media,
            ],
          });

          return hash;
        },
        {
          loadingMessage: "Registering action...",
          successMessage: "Action registered successfully",
          errorMessage: "Failed to register action",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionStartTime = async (actionUID: string, startTime: number) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionStartTime",
            account: address,
            args: [BigInt(actionUID), BigInt(startTime)],
          });

          return hash;
        },
        {
          loadingMessage: "Updating start time...",
          successMessage: "Start time updated successfully",
          errorMessage: "Failed to update start time",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionEndTime = async (actionUID: string, endTime: number) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionEndTime",
            account: address,
            args: [BigInt(actionUID), BigInt(endTime)],
          });

          return hash;
        },
        {
          loadingMessage: "Updating end time...",
          successMessage: "End time updated successfully",
          errorMessage: "Failed to update end time",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionTitle = async (actionUID: string, title: string) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionTitle",
            account: address,
            args: [BigInt(actionUID), title],
          });

          return hash;
        },
        {
          loadingMessage: "Updating title...",
          successMessage: "Title updated successfully",
          errorMessage: "Failed to update title",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionInstructions = async (actionUID: string, instructions: string) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionInstructions",
            account: address,
            args: [BigInt(actionUID), instructions],
          });

          return hash;
        },
        {
          loadingMessage: "Updating instructions...",
          successMessage: "Instructions updated successfully",
          errorMessage: "Failed to update instructions",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionMedia = async (actionUID: string, media: string[]) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionMedia",
            account: address,
            args: [BigInt(actionUID), media],
          });

          return hash;
        },
        {
          loadingMessage: "Updating media...",
          successMessage: "Media updated successfully",
          errorMessage: "Failed to update media",
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerAction,
    updateActionStartTime,
    updateActionEndTime,
    updateActionTitle,
    updateActionInstructions,
    updateActionMedia,
    isLoading,
  };
}
