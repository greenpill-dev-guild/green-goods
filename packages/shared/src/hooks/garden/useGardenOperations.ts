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
import { createGardenMembersChain } from "../../modules/garden/members-batch";
import {
  readHeldRoles,
  type RoleRemovalApi,
  type RoleRemovalChain,
  removeGardenRolesOneByOne,
} from "../../modules/garden/members-removal";
import type { Address, Garden } from "../../types/domain";
import { formatAddress } from "../../utils/app/text";
import { GARDEN_ROLE_IDS, type GardenRole } from "../../utils/blockchain/garden-roles";
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
import {
  applyOptimisticUpdate,
  isOnCachedRoster,
  resetRoleHatAnswers,
  rollBackFailedWrite,
} from "./gardenRosterCache";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { runGardenRoleWrites } from "./gardenRoleWriteQueue";

export { useAddMembersBatch } from "./useAddMembersBatch";
export type { AddMembersOutcome } from "../../modules/garden/members-batch";
export type {
  RoleRemovalApi,
  RoleRemovalOutcome,
  RoleRemovalStatus,
} from "../../modules/garden/members-removal";
export {
  type GardenSetup,
  type GardenSetupStep,
  type GardenSetupStepId,
  useGardenSetup,
} from "./useGardenSetup";

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
        alreadyHeld: isAdd
          ? (targetAddress) =>
              formatMessage(
                { id: "app.admin.roles.alreadyHeld" },
                { address: formatAddress(targetAddress), role, roleKey: memberType }
              )
          : undefined,
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

  // Wrapper that undoes a failed write's optimistic step. The roster is read
  // before the call, so a no-op step (adding someone already listed) is left
  // alone instead of being "undone" into a removal.
  const createOperationWrapper = useCallback(
    (operation: GardenOperation, memberType: GardenRole) => {
      return async (
        targetAddress: Address,
        options?: GardenOperationCallOptions
      ): Promise<GardenOperationResult> => {
        return runGardenRoleWrites(
          queryClient,
          chainId,
          gardenId,
          [{ address: targetAddress, role: memberType }],
          async () => {
            const queryKey = gardensKeys.byChain(chainId);
            const wasOnRoster = isOnCachedRoster(
              queryClient.getQueryData<Garden[]>(queryKey) ?? [],
              gardenId,
              memberType,
              targetAddress
            );

            const result = await operation(targetAddress, options);

            if (result.success) {
              // The chain now answers differently for this person, so a cached
              // "doesn't wear it" must not outlive the write (Add Members trusts it).
              void resetRoleHatAnswers(queryClient, gardenId, targetAddress);
            }

            const currentData = queryClient.getQueryData<Garden[]>(queryKey);
            if (!result.success && result.optimisticUpdate && currentData) {
              queryClient.setQueryData(
                queryKey,
                rollBackFailedWrite(currentData, gardenId, result.optimisticUpdate, wasOnRoster)
              );
            }

            return result;
          }
        );
      };
    },
    [chainId, gardenId, queryClient]
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
        "gardener"
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
        "gardener"
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
        "steward"
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
        "steward"
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
        "evaluator"
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
        "evaluator"
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
        "owner"
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
        "owner"
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
        "funder"
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
        "funder"
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
        "community"
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
        "community"
      ),
    };
  }, [
    gardenAddress,
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

/**
 * Removes person-and-role pairs with one signature each, reading the chain before every
 * signature and after any send that does not end cleanly (`removeGardenRolesOneByOne`). Each
 * send is the role operation a single removal uses, with its simulation, roster update and
 * toasts, so one removal and many take the same path.
 */
export function useRemoveMemberRoles(gardenId: string): RoleRemovalApi {
  const gardenAddress = gardenId as Address;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const account = usePrimaryAddress();
  const {
    removeGardener,
    removeSteward,
    removeEvaluator,
    removeOwner,
    removeFunder,
    removeCommunity,
  } = useGardenOperations(gardenId);

  return useMemo(() => {
    const removeByRole: Record<GardenRole, GardenOperation> = {
      gardener: removeGardener,
      steward: removeSteward,
      evaluator: removeEvaluator,
      owner: removeOwner,
      funder: removeFunder,
      community: removeCommunity,
    };
    const members = createGardenMembersChain(gardenAddress, chainId);
    const chain: RoleRemovalChain = {
      wearsRole: (row) => members.wearsRole(row),
      refusal: async ({ address, role }) => {
        const hatsModule = await members.hatsModule();
        // Without a module or a signer the send itself says what is missing.
        if (!hatsModule || !account) return null;
        return members.refusal(
          {
            address: hatsModule,
            functionName: "revokeRole",
            args: [gardenAddress, address, GARDEN_ROLE_IDS[role]],
          },
          account
        );
      },
      removeRole: ({ address, role }) => removeByRole[role](address),
      // The roster lags the chain, so a role a read proved gone leaves it now.
      onGone: ({ address, role }) => {
        const key = gardensKeys.byChain(chainId);
        const gardens = queryClient.getQueryData<Garden[]>(key);
        if (gardens) {
          queryClient.setQueryData(
            key,
            applyOptimisticUpdate(gardens, gardenId, role, "remove", address)
          );
        }
        void resetRoleHatAnswers(queryClient, gardenId, address);
      },
    };
    return {
      account,
      check: (rows) => readHeldRoles(rows, chain),
      remove: (rows, events) => removeGardenRolesOneByOne(rows, chain, events),
    };
  }, [
    account,
    chainId,
    gardenAddress,
    gardenId,
    queryClient,
    removeCommunity,
    removeEvaluator,
    removeFunder,
    removeGardener,
    removeOwner,
    removeSteward,
  ]);
}
