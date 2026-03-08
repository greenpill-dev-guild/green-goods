/**
 * Garden Operations Hook
 *
 * Provides functions to manage garden members (gardeners and operators).
 * Uses the createGardenOperation factory for consistent behavior.
 * Includes transaction simulation and optimistic UI updates.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAccount, useWalletClient } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Garden } from "../../types/domain";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { useToastAction } from "../app/useToastAction";
import { queryKeys } from "../query-keys";
import {
  createGardenOperation,
  GARDEN_OPERATIONS,
  type GardenOperationMessages,
  type GardenOperationResult,
  type OptimisticUpdateCallback,
} from "./createGardenOperation";

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
    operator: "operators",
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
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const { formatMessage } = useIntl();

  const roleLabels = useMemo<Record<GardenRole, string>>(
    () => ({
      gardener: formatMessage({ id: "app.roles.gardener" }),
      operator: formatMessage({ id: "app.roles.operator" }),
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
    (memberType: GardenRole, operationType: "add" | "remove", targetAddress: string) => {
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
      memberType: GardenRole,
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
    const narrowedAddress = address as `0x${string}`;

    return {
      addGardener: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.addGardener,
            messages: buildMessages("gardener", "add"),
          },
          walletClient,
          narrowedAddress,
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
          {
            ...GARDEN_OPERATIONS.removeGardener,
            messages: buildMessages("gardener", "remove"),
          },
          walletClient,
          narrowedAddress,
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
          {
            ...GARDEN_OPERATIONS.addOperator,
            messages: buildMessages("operator", "add"),
          },
          walletClient,
          narrowedAddress,
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
          {
            ...GARDEN_OPERATIONS.removeOperator,
            messages: buildMessages("operator", "remove"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "operator",
        "remove"
      ),
      addEvaluator: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.addEvaluator,
            messages: buildMessages("evaluator", "add"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "evaluator",
        "add"
      ),
      removeEvaluator: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.removeEvaluator,
            messages: buildMessages("evaluator", "remove"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "evaluator",
        "remove"
      ),
      addOwner: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.addOwner,
            messages: buildMessages("owner", "add"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "owner",
        "add"
      ),
      removeOwner: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.removeOwner,
            messages: buildMessages("owner", "remove"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "owner",
        "remove"
      ),
      addFunder: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.addFunder,
            messages: buildMessages("funder", "add"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "funder",
        "add"
      ),
      removeFunder: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.removeFunder,
            messages: buildMessages("funder", "remove"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "funder",
        "remove"
      ),
      addCommunity: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.addCommunity,
            messages: buildMessages("community", "add"),
          },
          walletClient,
          narrowedAddress,
          executeWithToast,
          setIsLoading,
          optimisticCallback
        ),
        "community",
        "add"
      ),
      removeCommunity: createOperationWrapper(
        createGardenOperation(
          gardenId,
          {
            ...GARDEN_OPERATIONS.removeCommunity,
            messages: buildMessages("community", "remove"),
          },
          walletClient,
          narrowedAddress,
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
    walletClient,
    address,
    executeWithToast,
    createOptimisticCallback,
    createOperationWrapper,
    buildMessages,
  ]);

  return {
    ...operations,
    isLoading,
  };
}
