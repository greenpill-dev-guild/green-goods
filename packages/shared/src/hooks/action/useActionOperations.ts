/**
 * Action Operations Hook
 *
 * Provides functions to manage actions in the ActionRegistry.
 * Includes transaction simulation to catch errors before execution.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Abi } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { toastService } from "../../components/toast";
import { Capital } from "../../modules/data/greengoods";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { simulateTransaction } from "../../utils/contract/simulation";
import { parseContractError } from "../../utils/errors/contract-errors";
import { useToastAction } from "../app/useToastAction";
import { queryKeys } from "../query-keys";

/**
 * Result of an action operation
 */
export interface ActionOperationResult {
  /** Transaction hash if successful */
  hash?: `0x${string}`;
  /** Whether the operation was successful */
  success: boolean;
  /** Error if operation failed */
  error?: {
    name: string;
    message: string;
    action?: string;
  };
}

export function useActionOperations(chainId: number) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const contracts = getNetworkContracts(chainId);
  const queryClient = useQueryClient();

  // Schedule background refetch to sync with indexer
  const scheduleBackgroundRefetch = useCallback(() => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.byChain(chainId) });
    }, 5000);
  }, [queryClient, chainId]);

  const registerAction = async (params: {
    startTime: number;
    endTime: number;
    title: string;
    instructions: string;
    capitals: Capital[];
    media: string[];
  }): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      // Step 1: Simulate the transaction using shared utility
      const args = [
        BigInt(params.startTime),
        BigInt(params.endTime),
        params.title,
        params.instructions,
        params.capitals,
        params.media,
      ];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "registerAction",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      // Step 2: Execute the actual transaction
      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
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
        },
        {
          loadingMessage: "Registering action...",
          successMessage: "Action registered successfully",
          errorMessage: "Failed to register action",
        }
      );

      // Schedule background refetch
      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionStartTime = async (
    actionUID: string,
    startTime: number
  ): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      const args = [BigInt(actionUID), BigInt(startTime)];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "updateActionStartTime",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionStartTime",
            account: address,
            args: [BigInt(actionUID), BigInt(startTime)],
          });
        },
        {
          loadingMessage: "Updating start time...",
          successMessage: "Start time updated successfully",
          errorMessage: "Failed to update start time",
        }
      );

      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionEndTime = async (
    actionUID: string,
    endTime: number
  ): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      const args = [BigInt(actionUID), BigInt(endTime)];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "updateActionEndTime",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionEndTime",
            account: address,
            args: [BigInt(actionUID), BigInt(endTime)],
          });
        },
        {
          loadingMessage: "Updating end time...",
          successMessage: "End time updated successfully",
          errorMessage: "Failed to update end time",
        }
      );

      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionTitle = async (
    actionUID: string,
    title: string
  ): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      const args = [BigInt(actionUID), title];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "updateActionTitle",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionTitle",
            account: address,
            args: [BigInt(actionUID), title],
          });
        },
        {
          loadingMessage: "Updating title...",
          successMessage: "Title updated successfully",
          errorMessage: "Failed to update title",
        }
      );

      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionInstructions = async (
    actionUID: string,
    instructions: string
  ): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      const args = [BigInt(actionUID), instructions];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "updateActionInstructions",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionInstructions",
            account: address,
            args: [BigInt(actionUID), instructions],
          });
        },
        {
          loadingMessage: "Updating instructions...",
          successMessage: "Instructions updated successfully",
          errorMessage: "Failed to update instructions",
        }
      );

      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionMedia = async (
    actionUID: string,
    media: string[]
  ): Promise<ActionOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    setIsLoading(true);

    try {
      const args = [BigInt(actionUID), media];

      const simulation = await simulateTransaction(
        contracts.actionRegistry as `0x${string}`,
        ActionRegistryABI as Abi,
        "updateActionMedia",
        args,
        address
      );

      if (!simulation.success) {
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });

        return {
          success: false,
          error: simulation.error,
        };
      }

      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: contracts.actionRegistry as `0x${string}`,
            abi: ActionRegistryABI,
            functionName: "updateActionMedia",
            account: address,
            args: [BigInt(actionUID), media],
          });
        },
        {
          loadingMessage: "Updating media...",
          successMessage: "Media updated successfully",
          errorMessage: "Failed to update media",
        }
      );

      scheduleBackgroundRefetch();

      return { hash, success: true };
    } catch (error) {
      const parsed = parseContractError(error);
      return {
        success: false,
        error: {
          name: parsed.name,
          message: parsed.message,
          action: parsed.action,
        },
      };
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
