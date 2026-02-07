/**
 * Garden Operation Factory
 *
 * Creates standardized garden contract operations with consistent
 * error handling, loading state, toast notifications, transaction simulation,
 * and optimistic update support.
 */

import type { Abi, Address, WalletClient } from "viem";
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
import { GARDEN_HATS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardenHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { GARDEN_ROLE_IDS, type GardenRole } from "../../utils/blockchain/garden-roles";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import type { ToastActionOptions } from "../app/useToastAction";

/** Helper to track operation started - reduces duplicate conditionals */
function trackOperationStarted(
  gardenAddress: string,
  memberType: GardenRole,
  operationType: "add" | "remove",
  targetAddress: string
): void {
  const tracker =
    operationType === "add" ? trackAdminMemberAddStarted : trackAdminMemberRemoveStarted;
  tracker({ gardenAddress, memberType, targetAddress });
}

/** Helper to track operation success */
function trackOperationSuccess(
  gardenAddress: string,
  memberType: GardenRole,
  operationType: "add" | "remove",
  targetAddress: string,
  txHash: string
): void {
  const tracker =
    operationType === "add" ? trackAdminMemberAddSuccess : trackAdminMemberRemoveSuccess;
  tracker({ gardenAddress, memberType, targetAddress, txHash });
}

/** Helper to track operation failure */
function trackOperationFailed(
  gardenAddress: string,
  memberType: GardenRole,
  operationType: "add" | "remove",
  targetAddress: string,
  error: string
): void {
  const tracker =
    operationType === "add" ? trackAdminMemberAddFailed : trackAdminMemberRemoveFailed;
  tracker({ gardenAddress, memberType, targetAddress, error });
}

/**
 * Configuration for a garden operation
 */
export interface GardenOperationMessages {
  loading: string;
  success: string;
  error: string;
}

export interface GardenOperationConfigBase {
  /** The contract function name to call */
  functionName?: "addGardener" | "removeGardener" | "addGardenOperator" | "removeGardenOperator";
  /** Type of member being modified (for optimistic updates) */
  memberType: GardenRole;
  /** Whether this is an add or remove operation */
  operationType: "add" | "remove";
}

export interface GardenOperationConfig extends GardenOperationConfigBase {
  /** Toast messages for loading, success, and error states */
  messages: GardenOperationMessages;
  /** Error message for roles not supported on v1 gardens */
  unsupportedRoleMessage?: string;
}

/**
 * Pre-defined operation configurations
 */
export const GARDEN_OPERATIONS: Record<string, GardenOperationConfigBase> = {
  addGardener: {
    functionName: "addGardener",
    memberType: "gardener",
    operationType: "add",
  },
  removeGardener: {
    functionName: "removeGardener",
    memberType: "gardener",
    operationType: "remove",
  },
  addOperator: {
    functionName: "addGardenOperator",
    memberType: "operator",
    operationType: "add",
  },
  removeOperator: {
    functionName: "removeGardenOperator",
    memberType: "operator",
    operationType: "remove",
  },
  addEvaluator: {
    memberType: "evaluator",
    operationType: "add",
  },
  removeEvaluator: {
    memberType: "evaluator",
    operationType: "remove",
  },
  addOwner: {
    memberType: "owner",
    operationType: "add",
  },
  removeOwner: {
    memberType: "owner",
    operationType: "remove",
  },
  addFunder: {
    memberType: "funder",
    operationType: "add",
  },
  removeFunder: {
    memberType: "funder",
    operationType: "remove",
  },
  addCommunity: {
    memberType: "community",
    operationType: "add",
  },
  removeCommunity: {
    memberType: "community",
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
    memberType: GardenRole;
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
  memberType: GardenRole;
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
    trackOperationStarted(gardenId, config.memberType, config.operationType, targetAddress);

    setIsLoading(true);

    try {
      const chainId = walletClient.chain?.id;
      const hatsModuleAddress = await fetchGardenHatsModuleAddress(gardenId as Address, chainId);
      const useHatsModule = Boolean(hatsModuleAddress);

      const roleId = GARDEN_ROLE_IDS[config.memberType];
      if (!useHatsModule && !config.functionName) {
        setIsLoading(false);
        return {
          success: false,
          error: {
            name: "UnsupportedRole",
            message: config.unsupportedRoleMessage ?? config.messages.error,
          },
        };
      }

      const targetContract = (useHatsModule ? hatsModuleAddress : gardenId) as `0x${string}`;
      const targetAbi = useHatsModule ? (GARDEN_HATS_MODULE_ABI as Abi) : (GardenAccountABI as Abi);
      const targetFunctionName = useHatsModule
        ? config.operationType === "add"
          ? "grantRole"
          : "revokeRole"
        : (config.functionName as GardenOperationConfig["functionName"]);
      const targetArgs = useHatsModule ? [gardenId, targetAddress, roleId] : [targetAddress];

      // Step 1: Simulate the transaction using shared utility
      const simulation = await simulateTransaction(
        targetContract,
        targetAbi,
        targetFunctionName,
        targetArgs,
        address
      );

      if (!simulation.success) {
        // Track failure
        trackOperationFailed(
          gardenId,
          config.memberType,
          config.operationType,
          targetAddress,
          simulation.error?.message ?? "Simulation failed"
        );

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
            address: targetContract,
            abi: targetAbi,
            functionName: targetFunctionName,
            account: address,
            args: targetArgs,
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
      trackOperationSuccess(gardenId, config.memberType, config.operationType, targetAddress, hash);

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
      trackOperationFailed(
        gardenId,
        config.memberType,
        config.operationType,
        targetAddress,
        parsed.message
      );

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
