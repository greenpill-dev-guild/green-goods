/**
 * Garden Operation Factory
 *
 * Creates standardized garden contract operations with consistent
 * error handling, loading state, toast notifications, transaction simulation,
 * and optimistic update support.
 */

import type { Abi } from "viem";
import { toastService } from "../../components/toast";
import {
  trackAdminMemberAddFailed,
  trackAdminMemberAddStarted,
  trackAdminMemberAddSuccess,
  trackAdminMemberRemoveFailed,
  trackAdminMemberRemoveStarted,
  trackAdminMemberRemoveSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import type { TransactionSender } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { readGardenRoleHat } from "../../utils/blockchain/garden-role-reads";
import { GARDEN_ROLE_IDS, type GardenRole } from "../../utils/blockchain/garden-roles";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { parseContractError } from "../../utils/errors/contract-errors";
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
 * Pre-flight for adds. Granting a role the target already holds is a valid
 * transaction that changes nothing on chain, so the wallet must never be asked
 * for it. "Holds" means wears that exact hat, the test `grantRole` itself uses:
 * a steward without the gardener hat still gets one. Fails open: when the read
 * itself fails, the add continues exactly as it would without this check
 * (simulation, then the wallet prompt).
 */
async function targetAlreadyHoldsRole(
  hatsModuleAddress: Address,
  gardenId: Address,
  targetAddress: Address,
  role: GardenRole,
  chainId: number
): Promise<boolean> {
  try {
    return await readGardenRoleHat(gardenId, targetAddress, role, chainId, hatsModuleAddress);
  } catch (error) {
    logger.warn("Role pre-flight read failed; continuing with the add", {
      error,
      gardenId,
      role,
    });
    return false;
  }
}

/**
 * Configuration for a garden operation
 */
export interface GardenOperationMessages {
  loading: string;
  success: string;
  error: string;
  /**
   * Add only: the notice shown when the chain says the target already holds
   * the role, so nothing is sent.
   */
  alreadyHeld?: (targetAddress: Address) => string;
}

export interface GardenOperationConfigBase {
  /** Type of member being modified (for optimistic updates) */
  memberType: GardenRole;
  /** Whether this is an add or remove operation */
  operationType: "add" | "remove";
}

export interface GardenOperationConfig extends GardenOperationConfigBase {
  /** Toast messages for loading, success, and error states */
  messages: GardenOperationMessages;
}

/**
 * Pre-defined operation configurations
 */
export const GARDEN_OPERATIONS: Record<string, GardenOperationConfigBase> = {
  addGardener: {
    memberType: "gardener",
    operationType: "add",
  },
  removeGardener: {
    memberType: "gardener",
    operationType: "remove",
  },
  addSteward: {
    memberType: "steward",
    operationType: "add",
  },
  removeSteward: {
    memberType: "steward",
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
  /**
   * Add only: the target already held the role on chain, so no transaction
   * was sent. Counts as success, because the intended end state already exists.
   */
  alreadyHeld?: true;
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

export interface GardenOperationCallOptions {
  /** Queue actions carry applicant addresses and must not use member-level analytics. */
  trackMemberAnalytics?: boolean;
}

export type GardenOperation = (
  targetAddress: Address,
  options?: GardenOperationCallOptions
) => Promise<GardenOperationResult>;

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
 * @param sender - Auth-mode-aware transaction sender
 * @param address - The user's wallet address
 * @param executeWithToast - Toast action executor from useToastAction
 * @param setIsLoading - Loading state setter
 * @param onOptimisticUpdate - Optional callback for optimistic updates
 * @returns An async function that executes the operation with simulation
 */
export function createGardenOperation(
  gardenId: Address,
  config: GardenOperationConfig,
  sender: TransactionSender,
  address: Address,
  chainId: number,
  executeWithToast: ExecuteWithToast,
  setIsLoading: (loading: boolean) => void,
  onOptimisticUpdate?: OptimisticUpdateCallback
): GardenOperation {
  return async (
    targetAddress: Address,
    options: GardenOperationCallOptions = {}
  ): Promise<GardenOperationResult> => {
    let optimisticUpdate: GardenOperationResult["optimisticUpdate"];
    const shouldTrackMemberAnalytics = options.trackMemberAnalytics !== false;

    if (!sender || !address) {
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
      const hatsModuleAddress = await fetchHatsModuleAddress(gardenId, chainId);
      if (!hatsModuleAddress) {
        setIsLoading(false);
        return {
          success: false,
          error: {
            name: "HatsModuleNotConfigured",
            message: "Hats module is not configured for this garden",
          },
        };
      }

      if (
        config.operationType === "add" &&
        (await targetAlreadyHoldsRole(
          hatsModuleAddress,
          gardenId,
          targetAddress,
          config.memberType,
          chainId
        ))
      ) {
        // Nothing to sign. Record the membership the chain already has so a
        // lagging roster catches up, and say why no wallet prompt appeared.
        onOptimisticUpdate?.({
          memberType: config.memberType,
          operationType: "add",
          targetAddress,
        });
        const notice = config.messages.alreadyHeld?.(targetAddress);
        if (notice) toastService.info({ message: notice });
        return { success: true, alreadyHeld: true };
      }

      // Track operation started
      if (shouldTrackMemberAnalytics) {
        trackOperationStarted(gardenId, config.memberType, config.operationType, targetAddress);
      }

      const roleId = GARDEN_ROLE_IDS[config.memberType];

      const targetContract = hatsModuleAddress as `0x${string}`;
      const targetAbi = HATS_MODULE_ABI as Abi;
      const targetFunctionName = config.operationType === "add" ? "grantRole" : "revokeRole";
      const targetArgs = [gardenId, targetAddress, roleId];

      // Step 1: Simulate the transaction using shared utility
      const simulation = await simulateTransaction(
        targetContract,
        targetAbi,
        targetFunctionName,
        targetArgs,
        address,
        chainId
      );

      if (!simulation.success) {
        // Track failure
        if (shouldTrackMemberAnalytics) {
          trackOperationFailed(
            gardenId,
            config.memberType,
            config.operationType,
            targetAddress,
            simulation.error?.message ?? "Simulation failed"
          );
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
      optimisticUpdate = {
        memberType: config.memberType,
        operationType: config.operationType,
        targetAddress,
      };

      if (onOptimisticUpdate) {
        onOptimisticUpdate(optimisticUpdate);
      }

      // Step 3: Execute the actual transaction
      const transaction = await executeWithToast(
        () =>
          sender.sendContractCall({
            address: targetContract,
            abi: targetAbi,
            functionName: targetFunctionName,
            args: targetArgs,
            chainId,
          }),
        {
          loadingMessage: config.messages.loading,
          successMessage: config.messages.success,
          errorMessage: config.messages.error,
        }
      );
      const hash = transaction.hash;

      // Track operation success
      if (shouldTrackMemberAnalytics) {
        trackOperationSuccess(
          gardenId,
          config.memberType,
          config.operationType,
          targetAddress,
          hash
        );
      }

      return {
        hash,
        success: true,
        optimisticUpdate,
      };
    } catch (error) {
      // Parse and return the error - optimistic update will be rolled back by caller
      const parsed = parseContractError(error);

      // Track operation failure
      if (shouldTrackMemberAnalytics) {
        trackOperationFailed(
          gardenId,
          config.memberType,
          config.operationType,
          targetAddress,
          parsed.message
        );
      }

      return {
        success: false,
        optimisticUpdate,
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
