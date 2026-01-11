/**
 * Garden Operation Factory
 *
 * Creates standardized garden contract operations with consistent
 * error handling, loading state, toast notifications, transaction simulation,
 * and optimistic update support.
 */

import type { Abi, WalletClient } from "viem";
import { toastService } from "../../components/toast";
import {
  trackAdminMemberAddFailed,
  trackAdminMemberAddStarted,
  trackAdminMemberAddSuccess,
  trackAdminMemberRemoveFailed,
  trackAdminMemberRemoveStarted,
  trackAdminMemberRemoveSuccess,
} from "../../modules/app/analytics-events";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { simulateTransaction } from "../../utils/contract/simulation";
import type { ToastActionOptions } from "../app/useToastAction";

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
  /** Type of member being modified (for optimistic updates) */
  memberType: "gardener" | "operator";
  /** Whether this is an add or remove operation */
  operationType: "add" | "remove";
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
    memberType: "gardener",
    operationType: "add",
  },
  removeGardener: {
    functionName: "removeGardener",
    messages: {
      loading: "Removing gardener...",
      success: "Gardener removed successfully",
      error: "Failed to remove gardener",
    },
    memberType: "gardener",
    operationType: "remove",
  },
  addOperator: {
    functionName: "addGardenOperator",
    messages: {
      loading: "Adding operator...",
      success: "Operator added successfully",
      error: "Failed to add operator",
    },
    memberType: "operator",
    operationType: "add",
  },
  removeOperator: {
    functionName: "removeGardenOperator",
    messages: {
      loading: "Removing operator...",
      success: "Operator removed successfully",
      error: "Failed to remove operator",
    },
    memberType: "operator",
    operationType: "remove",
  },
};

/**
 * Type for the executeWithToast function from useToastAction
 */
type ExecuteWithToast = <T>(action: () => Promise<T>, options: ToastActionOptions) => Promise<T>;

/**
 * Result of a garden operation including optimistic update info
 */
export interface GardenOperationResult {
  /** Transaction hash if successful */
  hash?: `0x${string}`;
  /** Whether the operation was successful */
  success: boolean;
  /** Optimistic update data */
  optimisticUpdate?: {
    memberType: "gardener" | "operator";
    operationType: "add" | "remove";
    targetAddress: string;
  };
  /** Error if operation failed */
  error?: {
    name: string;
    message: string;
    action?: string;
  };
}

/**
 * Callback for applying optimistic updates
 */
export type OptimisticUpdateCallback = (update: {
  memberType: "gardener" | "operator";
  operationType: "add" | "remove";
  targetAddress: string;
}) => void;

/**
 * Creates a garden operation function that handles contract calls
 * with transaction simulation, optimistic updates, consistent error handling,
 * and toast notifications.
 *
 * @param gardenId - The garden contract address
 * @param config - Operation configuration (function name and messages)
 * @param walletClient - The wallet client for signing transactions
 * @param address - The user's wallet address
 * @param executeWithToast - Toast action executor from useToastAction
 * @param setIsLoading - Loading state setter
 * @param onOptimisticUpdate - Optional callback for optimistic updates
 * @returns An async function that executes the operation with simulation
 */
export function createGardenOperation(
  gardenId: string,
  config: GardenOperationConfig,
  walletClient: WalletClient,
  address: `0x${string}`,
  executeWithToast: ExecuteWithToast,
  setIsLoading: (loading: boolean) => void,
  onOptimisticUpdate?: OptimisticUpdateCallback
): (targetAddress: string) => Promise<GardenOperationResult> {
  return async (targetAddress: string): Promise<GardenOperationResult> => {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    // Track operation started
    if (config.operationType === "add") {
      trackAdminMemberAddStarted({
        gardenAddress: gardenId,
        memberType: config.memberType,
        targetAddress,
      });
    } else {
      trackAdminMemberRemoveStarted({
        gardenAddress: gardenId,
        memberType: config.memberType,
        targetAddress,
      });
    }

    setIsLoading(true);

    try {
      // Step 1: Simulate the transaction using shared utility
      const simulation = await simulateTransaction(
        gardenId as `0x${string}`,
        GardenAccountABI as Abi,
        config.functionName,
        [targetAddress],
        address
      );

      if (!simulation.success) {
        // Track failure
        if (config.operationType === "add") {
          trackAdminMemberAddFailed({
            gardenAddress: gardenId,
            memberType: config.memberType,
            targetAddress,
            error: simulation.error?.message ?? "Simulation failed",
          });
        } else {
          trackAdminMemberRemoveFailed({
            gardenAddress: gardenId,
            memberType: config.memberType,
            targetAddress,
            error: simulation.error?.message ?? "Simulation failed",
          });
        }

        // Show error toast for simulation failure
        toastService.error({
          title: simulation.error?.name ?? "Transaction Failed",
          message: simulation.error?.message ?? "Transaction simulation failed",
          context: "garden operation",
        });

        setIsLoading(false);
        return {
          success: false,
          error: simulation.error,
        };
      }

      // Step 2: Apply optimistic update before transaction
      const optimisticUpdate = {
        memberType: config.memberType,
        operationType: config.operationType,
        targetAddress,
      };

      if (onOptimisticUpdate) {
        onOptimisticUpdate(optimisticUpdate);
      }

      // Step 3: Execute the actual transaction
      const hash = await executeWithToast(
        async () => {
          return await walletClient.writeContract({
            address: gardenId as `0x${string}`,
            abi: GardenAccountABI,
            functionName: config.functionName,
            account: address,
            args: [targetAddress],
            chain: walletClient.chain,
          });
        },
        {
          loadingMessage: config.messages.loading,
          successMessage: config.messages.success,
          errorMessage: config.messages.error,
        }
      );

      // Track operation success
      if (config.operationType === "add") {
        trackAdminMemberAddSuccess({
          gardenAddress: gardenId,
          memberType: config.memberType,
          targetAddress,
          txHash: hash,
        });
      } else {
        trackAdminMemberRemoveSuccess({
          gardenAddress: gardenId,
          memberType: config.memberType,
          targetAddress,
          txHash: hash,
        });
      }

      return {
        hash,
        success: true,
        optimisticUpdate,
      };
    } catch (error) {
      // Parse and return the error - optimistic update will be rolled back by caller
      const { parseContractError } = await import("../../utils/errors/contract-errors");
      const parsed = parseContractError(error);

      // Track operation failure
      if (config.operationType === "add") {
        trackAdminMemberAddFailed({
          gardenAddress: gardenId,
          memberType: config.memberType,
          targetAddress,
          error: parsed.message,
        });
      } else {
        trackAdminMemberRemoveFailed({
          gardenAddress: gardenId,
          memberType: config.memberType,
          targetAddress,
          error: parsed.message,
        });
      }

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
}
