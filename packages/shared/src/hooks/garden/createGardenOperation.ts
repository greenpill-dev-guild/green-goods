/**
 * Garden Operation Factory
 *
 * Creates standardized garden contract operations with consistent
 * error handling, loading state, and toast notifications.
 */

import type { WalletClient } from "viem";
import type { ToastActionOptions } from "../app/useToastAction";
import { GardenAccountABI } from "../../utils/contracts";

/**
 * Configuration for a garden operation
 */
export interface GardenOperationConfig {
  /** The contract function name to call */
  functionName: "addGardener" | "removeGardener" | "addGardenOperator" | "removeGardenOperator";
  /** Toast messages for loading, success, and error states */
  messages: {
    loading: string;
    success: string;
    error: string;
  };
}

/**
 * Pre-defined operation configurations
 */
export const GARDEN_OPERATIONS: Record<string, GardenOperationConfig> = {
  addGardener: {
    functionName: "addGardener",
    messages: {
      loading: "Adding gardener...",
      success: "Gardener added successfully",
      error: "Failed to add gardener",
    },
  },
  removeGardener: {
    functionName: "removeGardener",
    messages: {
      loading: "Removing gardener...",
      success: "Gardener removed successfully",
      error: "Failed to remove gardener",
    },
  },
  addOperator: {
    functionName: "addGardenOperator",
    messages: {
      loading: "Adding operator...",
      success: "Operator added successfully",
      error: "Failed to add operator",
    },
  },
  removeOperator: {
    functionName: "removeGardenOperator",
    messages: {
      loading: "Removing operator...",
      success: "Operator removed successfully",
      error: "Failed to remove operator",
    },
  },
};

/**
 * Type for the executeWithToast function from useToastAction
 */
type ExecuteWithToast = <T>(action: () => Promise<T>, options: ToastActionOptions) => Promise<T>;

/**
 * Creates a garden operation function that handles contract calls
 * with consistent error handling and toast notifications.
 *
 * @param gardenId - The garden contract address
 * @param config - Operation configuration (function name and messages)
 * @param walletClient - The wallet client for signing transactions
 * @param address - The user's wallet address
 * @param executeWithToast - Toast action executor from useToastAction
 * @param setIsLoading - Loading state setter
 * @returns An async function that executes the operation
 */
export function createGardenOperation(
  gardenId: string,
  config: GardenOperationConfig,
  walletClient: WalletClient,
  address: `0x${string}`,
  executeWithToast: ExecuteWithToast,
  setIsLoading: (loading: boolean) => void
): (targetAddress: string) => Promise<`0x${string}` | undefined> {
  return async (targetAddress: string) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI,
            functionName: config.functionName,
            account: address,
            args: [targetAddress],
            chain: walletClient.chain,
          });

          return hash;
        },
        {
          loadingMessage: config.messages.loading,
          successMessage: config.messages.success,
          errorMessage: config.messages.error,
        }
      );

      return result;
    } finally {
      setIsLoading(false);
    }
  };
}
