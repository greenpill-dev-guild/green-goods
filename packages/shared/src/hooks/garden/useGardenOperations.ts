/**
 * Garden Operations Hook
 *
 * Provides functions to manage garden members (gardeners and operators).
 * Uses the createGardenOperation factory for consistent behavior.
 * Includes transaction simulation and optimistic UI updates.
 */

import { useQueryClient } from "@tanstack/react-query";
import type { Garden } from "../../types/domain";
import { useCallback, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { useToastAction } from "../app/useToastAction";
import { queryKeys } from "../query-keys";
import {
  createGardenOperation,
  GARDEN_OPERATIONS,
  type GardenOperationResult,
  type OptimisticUpdateCallback,
} from "./createGardenOperation";

/**
 * Apply optimistic update to garden cache data
 */
function applyOptimisticUpdate(
  gardens: Garden[],
  gardenId: string,
  memberType: "gardener" | "operator",
  operationType: "add" | "remove",
  targetAddress: string
): Garden[] {
  return gardens.map((garden) => {
    if (garden.id !== gardenId) return garden;

    const memberKey = memberType === "gardener" ? "gardeners" : "operators";
    const currentMembers = garden[memberKey] || [];

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
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  // Create optimistic update callback that modifies the cache
  const createOptimisticCallback = useCallback(
    (): OptimisticUpdateCallback => (update) => {
      const queryKey = queryKeys.gardens.byChain(DEFAULT_CHAIN_ID);

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
    [gardenId, queryClient]
  );

  // Rollback optimistic update on failure
  const rollbackOptimisticUpdate = useCallback(
    (
      memberType: "gardener" | "operator",
      operationType: "add" | "remove",
      targetAddress: string
    ) => {
      const queryKey = queryKeys.gardens.byChain(DEFAULT_CHAIN_ID);
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
    [gardenId, queryClient]
  );

  // Wrapper to handle operation result and potential rollback
  const createOperationWrapper = useCallback(
    (
      operation: (targetAddress: string) => Promise<GardenOperationResult>,
      memberType: "gardener" | "operator",
      operationType: "add" | "remove"
    ) => {
      return async (targetAddress: string): Promise<GardenOperationResult> => {
        const result = await operation(targetAddress);

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
    if (!walletClient || !address) {
      // Return no-op functions when wallet is not connected
      const notConnected = async (): Promise<GardenOperationResult> => ({
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      });
      return {
        addGardener: notConnected,
        removeGardener: notConnected,
        addOperator: notConnected,
        removeOperator: notConnected,
      };
    }

    const optimisticCallback = createOptimisticCallback();

    return {
      addGardener: createOperationWrapper(
        createGardenOperation(
          gardenId,
          GARDEN_OPERATIONS.addGardener,
          walletClient,
          address,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "gardener",
        "add"
      ),
      removeGardener: createOperationWrapper(
        createGardenOperation(
          gardenId,
          GARDEN_OPERATIONS.removeGardener,
          walletClient,
          address,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "gardener",
        "remove"
      ),
      addOperator: createOperationWrapper(
        createGardenOperation(
          gardenId,
          GARDEN_OPERATIONS.addOperator,
          walletClient,
          address,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "operator",
        "add"
      ),
      removeOperator: createOperationWrapper(
        createGardenOperation(
          gardenId,
          GARDEN_OPERATIONS.removeOperator,
          walletClient,
          address,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "operator",
        "remove"
      ),
    };
  }, [
    gardenId,
    walletClient,
    address,
    executeWithToast,
    createOptimisticCallback,
    createOperationWrapper,
  ]);

  return {
    ...operations,
    isLoading,
  };
}
