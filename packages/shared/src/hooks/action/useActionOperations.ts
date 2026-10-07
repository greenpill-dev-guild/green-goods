/**
 * Action Operations Hook
 *
 * Provides functions to manage actions in the ActionRegistry.
 * Uses a shared executor to eliminate duplication across 6 operations.
 * Each operation follows: account check → simulation → execution → refetch.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Abi } from "viem";
import {
  getTransactionScopeKey,
  TransactionConfirmationPendingError,
} from "../../modules/transactions/types";
import { useIntl } from "react-intl";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { toastService } from "../../components/toast";
import {
  type ActionOperationCommand,
  type ActionOperationResult,
  createDefaultActionOperationPorts,
  executeActionOperation,
} from "../../modules/action/action-operation-command";
import { Capital, Domain } from "../../types/domain";
import { reconcileTransaction } from "../../modules/transactions/confirmation";
import { useActionRegistrationStore } from "../../stores/useActionRegistrationStore";
import {
  ActionRegistryABI,
  getNetworkContracts,
  createClients,
} from "../../utils/blockchain/contracts";
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

export function useActionOperations(chainId: number, actionUID?: string) {
  // Loading counter — fixes the shared-boolean bug where concurrent
  // operations could prematurely clear the loading state.
  const loadingCount = useRef(0);
  const [isLoading, setIsLoading] = useState(false);

  const { executeWithToast } = useToastAction();
  const address = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const contracts = getNetworkContracts(chainId);
  const queryClient = useQueryClient();
  const registrationScope = address ? getTransactionScopeKey(address, chainId) : null;
  const pendingRegistration = useActionRegistrationStore((state) =>
    registrationScope ? state.pending[registrationScope] : undefined
  );
  const edits = useActionRegistrationStore((state) => state.edits);
  const pendingEdits = Object.entries(edits).filter(
    ([key, edit]) =>
      registrationScope &&
      key.startsWith(`${registrationScope}:`) &&
      (!actionUID || key.endsWith(`:${actionUID}`)) &&
      !edit.confirmed
  );
  const reconcileEdits = async () => {
    if (!sender) return;
    for (const [key, edit] of pendingEdits) {
      const outcome = await reconcileTransaction(sender, edit.result, (hash) =>
        createClients(chainId).publicClient.getTransactionReceipt({ hash })
      );
      const store = useActionRegistrationStore.getState();
      if (store.edits[key] !== edit) continue;
      if (outcome.status === "confirmed") store.confirmEdit(key);
      else if (outcome.status === "reverted") store.clearEdit(key);
      if (outcome.status === "reverted")
        toastService.error({
          title: "Transaction reverted",
          message: formatMessage({ id: "app.account.transactionReverted" }),
        });
      void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });
    }
  };
  const clearCompletedEdits = () => {
    for (const [key, edit] of Object.entries(useActionRegistrationStore.getState().edits)) {
      if (
        edit.confirmed &&
        registrationScope &&
        key.startsWith(`${registrationScope}:`) &&
        (!actionUID || key.endsWith(`:${actionUID}`))
      )
        useActionRegistrationStore.getState().clearEdit(key);
    }
  };

  const reconcileRegistration = async (): Promise<ActionOperationResult> => {
    if (!address || !registrationScope) return { success: false };
    const pending = useActionRegistrationStore.getState().pending[registrationScope];
    if (!pending) return { success: false };
    if (!sender) return { success: false, confirmation: "pending", hash: pending.hash };
    const outcome = await reconcileTransaction(sender, pending, (hash) =>
      createClients(chainId).publicClient.getTransactionReceipt({ hash })
    );
    if (useActionRegistrationStore.getState().pending[registrationScope] !== pending)
      return { success: false, confirmation: "pending", hash: pending.hash };
    void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });
    if (outcome.status === "confirmed") {
      useActionRegistrationStore.getState().clear(address, chainId);
      scheduleBackgroundRefetch();
      return { success: true, hash: outcome.transactionHash };
    }
    if (outcome.status === "reverted") {
      useActionRegistrationStore.getState().clear(address, chainId);
      return {
        success: false,
        error: {
          name: "TransactionReverted",
          message: formatMessage({
            id: "app.account.transactionReverted",
            defaultMessage: "Transaction reverted. Your change was not recorded.",
          }),
        },
      };
    }
    return { success: false, confirmation: "pending", hash: pending.hash };
  };

  // Schedule background refetch to sync with indexer
  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(
    useCallback(
      () => queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) }),
      [queryClient, chainId]
    ),
    INDEXER_SYNC_DELAY_MS
  );

  /**
   * Wraps an operation with account check, loading tracking, and error parsing.
   */
  async function withTracking(
    buildConfig: () => ActionOperationCommand
  ): Promise<ActionOperationResult> {
    if (!address || !sender) {
      return {
        success: false,
        error: {
          name: "AccountNotReady",
          message: formatMessage({
            id: !address ? "app.account.signInRequired" : "app.account.signerNotReady",
          }),
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
    const editKey =
      registrationScope && call.functionName !== "registerAction"
        ? `${registrationScope}:${call.functionName}:${String(call.args[0])}`
        : null;
    const fingerprint = JSON.stringify(call.args, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    );

    try {
      if (call.functionName === "registerAction" && registrationScope) {
        const pending = useActionRegistrationStore.getState().pending[registrationScope];
        if (pending) return { success: false, confirmation: "pending", hash: pending.hash };
      }
      if (editKey) {
        const edit = useActionRegistrationStore.getState().edits[editKey];
        if (edit && !edit.confirmed)
          return { success: false, confirmation: "pending", hash: edit.result.hash };
        if (edit?.confirmed && edit.fingerprint === fingerprint)
          return { success: true, hash: edit.result.hash };
      }
      const result = await executeActionOperation(
        call,
        createDefaultActionOperationPorts({ executeWithToast, transactionSender: sender })
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
      if (error instanceof TransactionConfirmationPendingError && error.submission) {
        if (call.functionName === "registerAction")
          useActionRegistrationStore.getState().record(address, chainId, error.submission);
        else if (editKey)
          useActionRegistrationStore.getState().recordEdit(editKey, fingerprint, error.submission);
        void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });
        scheduleBackgroundRefetch();
        return {
          success: false,
          confirmation: "pending",
          hash: error.submission.hash,
          error: {
            name: error.name,
            message: formatMessage({ id: "app.account.transactionPending" }),
          },
        };
      }
      const parsed =
        error instanceof TransactionConfirmationPendingError
          ? {
              name: error.name,
              message: formatMessage({ id: "app.account.transactionPending" }),
              action: undefined,
            }
          : parseContractError(error);
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

  const assertReady = async () => {
    if (!address || !sender)
      throw new Error(
        formatMessage({
          id: !address ? "app.account.signInRequired" : "app.account.signerNotReady",
        })
      );
    await sender.assertOwnership?.(address, chainId);
  };

  return {
    assertReady,
    pendingRegistration,
    registrationScope,
    reconcileRegistration,
    pendingEdits,
    reconcileEdits,
    clearCompletedEdits,
    registerAction,
    updateActionStartTime,
    updateActionEndTime,
    updateActionTitle,
    updateActionInstructions,
    updateActionMedia,
    isLoading,
  };
}
