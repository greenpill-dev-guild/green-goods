/**
 * Garden Operations Hook
 *
 * Provides functions to manage garden members (gardeners and stewards).
 * Uses the createGardenOperation factory for consistent behavior.
 * Includes transaction simulation and optimistic UI updates.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address, Garden } from "../../types/domain";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { useToastAction } from "../app/useToastAction";
import { gardensKeys } from "../../config/query-keys/garden";
import {
  createGardenOperation,
  GARDEN_OPERATIONS,
  type GardenOperationMessages,
  type GardenOperation,
  type GardenOperationCallOptions,
  type GardenOperationResult,
  type OptimisticUpdateCallback,
} from "./createGardenOperation";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/**
 * Apply optimistic update to garden cache data
 */
function applyOptimisticUpdate(
  gardens: Garden[],
  gardenId: string,
  memberType: GardenRole,
  operationType: "add" | "remove",
  targetAddress: string
): Garden[] {
  const roleFieldMap: Record<GardenRole, keyof Garden> = {
    gardener: "gardeners",
    steward: "stewards",
    evaluator: "evaluators",
    owner: "owners",
    funder: "funders",
    community: "communities",
  };

  return gardens.map((garden) => {
    if (garden.id !== gardenId) return garden;

    const memberKey = roleFieldMap[memberType];
    const currentMembers = (garden[memberKey] as string[] | undefined) || [];

    let newMembers: string[];
    if (operationType === "add") {
      // Add if not already present
      if (currentMembers.includes(targetAddress.toLowerCase())) {
        newMembers = currentMembers;
      } else {
        newMembers = [...currentMembers, targetAddress.toLowerCase()];
      }
    } else {
      // Remove the address
      newMembers = currentMembers.filter(
        (addr) => addr.toLowerCase() !== targetAddress.toLowerCase()
      );
    }

    return {
      ...garden,
      [memberKey]: newMembers,
    };
  });
}

export function useGardenOperations(gardenId: string) {
  // Garden ids are token-bound account addresses; callers still pass them as route strings.
  const gardenAddress = gardenId as Address;
  const chainId = DEFAULT_CHAIN_ID;
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const address = usePrimaryAddress();
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const { formatMessage } = useIntl();

  const roleLabels = useMemo<Record<GardenRole, string>>(
    () => ({
      gardener: formatMessage({ id: "app.roles.gardener" }),
      steward: formatMessage({ id: "app.roles.steward" }),
      evaluator: formatMessage({ id: "app.roles.evaluator" }),
      owner: formatMessage({ id: "app.roles.owner" }),
      funder: formatMessage({ id: "app.roles.funder" }),
      community: formatMessage({ id: "app.roles.community" }),
    }),
    [formatMessage]
  );

  const buildMessages = useCallback(
    (memberType: GardenRole, operationType: "add" | "remove"): GardenOperationMessages => {
      const role = roleLabels[memberType];
      const isAdd = operationType === "add";
      return {
        loading: formatMessage(
          { id: isAdd ? "app.admin.roles.adding" : "app.admin.roles.removing" },
          { role }
        ),
        success: formatMessage(
          { id: isAdd ? "app.admin.roles.added" : "app.admin.roles.removed" },
          { role }
        ),
        error: formatMessage(
          { id: isAdd ? "app.admin.roles.addFailed" : "app.admin.roles.removeFailed" },
          { role }
        ),
      };
    },
    [formatMessage, roleLabels]
  );

  // Create optimistic update callback that modifies the cache
  const createOptimisticCallback = useCallback(
    (): OptimisticUpdateCallback => (update) => {
      const queryKey = gardensKeys.byChain(chainId);

      // Get current cache data
      const previousData = queryClient.getQueryData<Garden[]>(queryKey);
      if (!previousData) return;

      // Apply optimistic update
      const optimisticData = applyOptimisticUpdate(
        previousData,
        gardenId,
        update.memberType,
        update.operationType,
        update.targetAddress
      );

      // Update cache optimistically
      queryClient.setQueryData(queryKey, optimisticData);
    },
    [gardenId, queryClient, chainId]
  );

  // Rollback optimistic update on failure
  const rollbackOptimisticUpdate = useCallback(
    (memberType: GardenRole, operationType: "add" | "remove", targetAddress: string) => {
      const queryKey = gardensKeys.byChain(chainId);
      const currentData = queryClient.getQueryData<Garden[]>(queryKey);
      if (!currentData) return;

      // Reverse the operation
      const reverseOperation = operationType === "add" ? "remove" : "add";
      const rolledBackData = applyOptimisticUpdate(
        currentData,
        gardenId,
        memberType,
        reverseOperation,
        targetAddress
      );

      queryClient.setQueryData(queryKey, rolledBackData);
    },
    [gardenId, queryClient, chainId]
  );

  // Wrapper to handle operation result and potential rollback
  const createOperationWrapper = useCallback(
    (operation: GardenOperation, memberType: GardenRole, operationType: "add" | "remove") => {
      return async (
        targetAddress: Address,
        options?: GardenOperationCallOptions
      ): Promise<GardenOperationResult> => {
        const result = await operation(targetAddress, options);

        if (!result.success && result.optimisticUpdate) {
          // Rollback if transaction failed after optimistic update was applied
          rollbackOptimisticUpdate(memberType, operationType, targetAddress);
        }

        return result;
      };
    },
    [rollbackOptimisticUpdate]
  );

  // Create memoized operations using the factory with optimistic updates
  const operations = useMemo(() => {
    if (!sender || !address) {
      // Return no-op functions when wallet is not connected
      const notConnected: GardenOperation = async () => ({
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      });
      return {
        addGardener: notConnected,
        removeGardener: notConnected,
        addSteward: notConnected,
        removeSteward: notConnected,
        addEvaluator: notConnected,
        removeEvaluator: notConnected,
        addOwner: notConnected,
        removeOwner: notConnected,
        addFunder: notConnected,
        removeFunder: notConnected,
        addCommunity: notConnected,
        removeCommunity: notConnected,
      };
    }

    const optimisticCallback = createOptimisticCallback();
    return {
      addGardener: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addGardener,
            messages: buildMessages("gardener", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "gardener",
        "add"
      ),
      removeGardener: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeGardener,
            messages: buildMessages("gardener", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "gardener",
        "remove"
      ),
      addSteward: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addSteward,
            messages: buildMessages("steward", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "steward",
        "add"
      ),
      removeSteward: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeSteward,
            messages: buildMessages("steward", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "steward",
        "remove"
      ),
      addEvaluator: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addEvaluator,
            messages: buildMessages("evaluator", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "evaluator",
        "add"
      ),
      removeEvaluator: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeEvaluator,
            messages: buildMessages("evaluator", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "evaluator",
        "remove"
      ),
      addOwner: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addOwner,
            messages: buildMessages("owner", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "owner",
        "add"
      ),
      removeOwner: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeOwner,
            messages: buildMessages("owner", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "owner",
        "remove"
      ),
      addFunder: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addFunder,
            messages: buildMessages("funder", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "funder",
        "add"
      ),
      removeFunder: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeFunder,
            messages: buildMessages("funder", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "funder",
        "remove"
      ),
      addCommunity: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.addCommunity,
            messages: buildMessages("community", "add"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "community",
        "add"
      ),
      removeCommunity: createOperationWrapper(
        createGardenOperation(
          gardenAddress,
          {
            ...GARDEN_OPERATIONS.removeCommunity,
            messages: buildMessages("community", "remove"),
          },
          sender,
          address,
          chainId,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "community",
        "remove"
      ),
    };
  }, [
    gardenId,
    sender,
    address,
    executeWithToast,
    createOptimisticCallback,
    createOperationWrapper,
    buildMessages,
    chainId,
  ]);

  return {
    ...operations,
    isLoading,
  };
}
