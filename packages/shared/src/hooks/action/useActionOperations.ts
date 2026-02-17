/**
 * Action Operations Hook
 *
 * Provides functions to manage actions in the ActionRegistry.
 * Uses a shared executor to eliminate duplication across 6 operations.
 * Each operation follows: wallet check → simulation → execution → refetch.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Abi, WalletClient } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { toastService } from "../../components/toast";
import { Capital } from "../../modules/data/greengoods";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { parseContractError } from "../../utils/errors/contract-errors";
import { type ToastActionOptions, useToastAction } from "../app/useToastAction";
import { queryKeys } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

/** Delay before refetching after transaction to allow indexer sync */
const INDEXER_SYNC_DELAY_MS = 5000;

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

// ---------------------------------------------------------------------------
// Core executor — shared by all 6 operations
// ---------------------------------------------------------------------------

interface ActionOpConfig {
  functionName: string;
  args: unknown[];
  messages: { loading: string; success: string; error: string };
}

interface ActionOpDeps {
  contractAddress: `0x${string}`;
  abi: Abi;
  walletClient: WalletClient;
  address: `0x${string}`;
  executeWithToast: <T>(action: () => Promise<T>, options: ToastActionOptions) => Promise<T>;
  scheduleBackgroundRefetch: () => void;
}

/**
 * Executes an ActionRegistry contract call with simulation, toast, and refetch.
 * Extracted from the per-operation functions to eliminate ~400 lines of duplication.
 */
async function executeActionOperation(
  config: ActionOpConfig,
  deps: ActionOpDeps
): Promise<ActionOperationResult> {
  // Step 1: Simulate the transaction
  const simulation = await simulateTransaction(
    deps.contractAddress,
    deps.abi,
    config.functionName,
    config.args,
    deps.address
  );

  if (!simulation.success) {
    toastService.error({
      title: simulation.error?.name ?? "Transaction Failed",
      message: simulation.error?.message ?? "Transaction simulation failed",
      context: "action operation",
    });
    return { success: false, error: simulation.error };
  }

  // Step 2: Execute the actual transaction
  const hash = await deps.executeWithToast(
    async () =>
      deps.walletClient.writeContract({
        address: deps.contractAddress,
        abi: deps.abi,
        functionName: config.functionName,
        account: deps.address,
        args: config.args,
        chain: deps.walletClient.chain,
      }),
    {
      loadingMessage: config.messages.loading,
      successMessage: config.messages.success,
      errorMessage: config.messages.error,
    }
  );

  // Step 3: Schedule background refetch for indexer sync
  deps.scheduleBackgroundRefetch();

  return { hash, success: true };
}

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
      () => queryClient.invalidateQueries({ queryKey: queryKeys.actions.byChain(chainId) }),
      [queryClient, chainId]
    ),
    INDEXER_SYNC_DELAY_MS
  );

  /**
   * Wraps an operation with wallet check, loading tracking, and error parsing.
   */
  async function withTracking(
    buildConfig: (deps: ActionOpDeps) => ActionOpConfig
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

    const deps: ActionOpDeps = {
      contractAddress: contracts.actionRegistry as `0x${string}`,
      abi: ActionRegistryABI as Abi,
      walletClient,
      address: address as `0x${string}`,
      executeWithToast,
      scheduleBackgroundRefetch,
    };

    try {
      return await executeActionOperation(buildConfig(deps), deps);
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
        params.instructions,
        params.capitals,
        params.media,
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
