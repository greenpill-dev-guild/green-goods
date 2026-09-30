/**
 * Action Operations Hook
 *
 * Provides functions to manage actions in the ActionRegistry.
 * Uses a shared executor to eliminate duplication across 6 operations.
 * Each operation follows: wallet check → simulation → execution → refetch.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Abi } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { toastService } from "../../components/toast";
import {
  type ActionOperationCommand,
  type ActionOperationResult,
  createDefaultActionOperationPorts,
  executeActionOperation,
} from "../../modules/action/action-operation-command";
import { Capital, Domain } from "../../types/domain";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { useToastAction } from "../app/useToastAction";
import { actionsKeys } from "../../config/query-keys/garden";
import { useDelayedInvalidation } from "../utils/useTimeout";

/** Delay before refetching after transaction to allow indexer sync */
const INDEXER_SYNC_DELAY_MS = 5000;

/**
 * Result of an action operation
 */
export type { ActionOperationResult } from "../../modules/action/action-operation-command";

// ---------------------------------------------------------------------------
// Core executor — shared by all 6 operations
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useActionOperations(chainId: number) {
  // Loading counter — fixes the shared-boolean bug where concurrent
  // operations could prematurely clear the loading state.
  const loadingCount = useRef(0);
  const [isLoading, setIsLoading] = useState(false);

  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const contracts = getNetworkContracts(chainId);
  const queryClient = useQueryClient();

  // Schedule background refetch to sync with indexer
  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(
    useCallback(
      () => queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) }),
      [queryClient, chainId]
    ),
    INDEXER_SYNC_DELAY_MS
  );

  /**
   * Wraps an operation with wallet check, loading tracking, and error parsing.
   */
  async function withTracking(
    buildConfig: () => ActionOperationCommand
  ): Promise<ActionOperationResult> {
    if (!walletClient || !address) {
      return {
        success: false,
        error: {
          name: "WalletNotConnected",
          message: "Please connect your wallet to continue",
        },
      };
    }

    loadingCount.current++;
    setIsLoading(true);

    const call = {
      ...buildConfig(),
      contractAddress: contracts.actionRegistry as `0x${string}`,
      abi: ActionRegistryABI as Abi,
      account: address as `0x${string}`,
      chainId,
    };

    try {
      const result = await executeActionOperation(
        call,
        createDefaultActionOperationPorts({ walletClient, executeWithToast })
      );
      if (!result.success) {
        toastService.error({
          title: result.error?.name ?? "Transaction Failed",
          message: result.error?.message ?? "Transaction simulation failed",
          context: "action operation",
        });
      } else {
        scheduleBackgroundRefetch();
      }
      return result;
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
      loadingCount.current--;
      if (loadingCount.current === 0) setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — thin wrappers around withTracking
  // ---------------------------------------------------------------------------

  const registerAction = (params: {
    startTime: number;
    endTime: number;
    title: string;
    slug: string;
    domain: Domain;
    instructions: string;
    capitals: Capital[];
    media: string[];
  }): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "registerAction",
      args: [
        BigInt(params.startTime),
        BigInt(params.endTime),
        params.title,
        params.slug,
        params.instructions,
        params.capitals,
        params.media,
        params.domain,
      ],
      messages: {
        loading: "Registering action...",
        success: "Action registered successfully",
        error: "Failed to register action",
      },
    }));

  const updateActionStartTime = (
    actionUID: string,
    startTime: number
  ): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "updateActionStartTime",
      args: [BigInt(actionUID), BigInt(startTime)],
      messages: {
        loading: "Updating start time...",
        success: "Start time updated successfully",
        error: "Failed to update start time",
      },
    }));

  const updateActionEndTime = (
    actionUID: string,
    endTime: number
  ): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "updateActionEndTime",
      args: [BigInt(actionUID), BigInt(endTime)],
      messages: {
        loading: "Updating end time...",
        success: "End time updated successfully",
        error: "Failed to update end time",
      },
    }));

  const updateActionTitle = (actionUID: string, title: string): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "updateActionTitle",
      args: [BigInt(actionUID), title],
      messages: {
        loading: "Updating title...",
        success: "Title updated successfully",
        error: "Failed to update title",
      },
    }));

  const updateActionInstructions = (
    actionUID: string,
    instructions: string
  ): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "updateActionInstructions",
      args: [BigInt(actionUID), instructions],
      messages: {
        loading: "Updating instructions...",
        success: "Instructions updated successfully",
        error: "Failed to update instructions",
      },
    }));

  const updateActionMedia = (actionUID: string, media: string[]): Promise<ActionOperationResult> =>
    withTracking(() => ({
      functionName: "updateActionMedia",
      args: [BigInt(actionUID), media],
      messages: {
        loading: "Updating media...",
        success: "Media updated successfully",
        error: "Failed to update media",
      },
    }));

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
