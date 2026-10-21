/**
 * Action Operations Hook
 *
 * Provides functions to manage actions in the ActionRegistry.
 * Uses a shared executor to eliminate duplication across 6 operations.
 * Each operation follows: account check → simulation → execution → refetch.
 */

import { confirmCancelledSubmission } from "../../modules/transactions/cancelled-submission";
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
  fingerprintActionArguments,
} from "../../modules/action/action-operation-command";
import { Capital, Domain } from "../../types/domain";
import { reconcileTransaction } from "../../modules/transactions/confirmation";
import {
  trackAdminActionCreateFailed,
  trackAdminActionCreateSuccess,
} from "../../modules/app/analytics-events";
import {
  type ActionRegistrationDetails,
  useActionRegistrationStore,
} from "../../stores/useActionRegistrationStore";
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
  const activeRegistrationScope = useRef(registrationScope);
  activeRegistrationScope.current = registrationScope;
  const edits = useActionRegistrationStore((state) => state.edits);
  const pendingEdits = Object.entries(edits).filter(
    ([key, edit]) =>
      registrationScope &&
      key.startsWith(`${registrationScope}:`) &&
      (!actionUID || key.endsWith(`:${actionUID}`)) &&
      !edit.confirmed
  );
  const reconcileEdits = async () => {
    const confirmed: { key: string; fingerprint: string }[] = [];
    let unresolved = false;
    let reverted = false;
    if (!sender) return { confirmed, unresolved: true, reverted };
    for (const [key, edit] of pendingEdits) {
      const outcome = await reconcileTransaction(sender, edit.result, (hash) =>
        createClients(chainId).publicClient.getTransactionReceipt({ hash })
      );
      const store = useActionRegistrationStore.getState();
      if (store.edits[key] !== edit) continue;
      if (outcome.status === "confirmed") {
        store.confirmEdit(key);
        confirmed.push({ key, fingerprint: edit.fingerprint });
      } else if (outcome.status === "reverted") {
        store.clearEdit(key);
        reverted = true;
      } else unresolved = true;
    }
    if (reverted)
      toastService.error({
        title: formatMessage({ id: "app.account.transactionRevertedTitle" }),
        message: formatMessage({ id: "app.account.transactionReverted" }),
      });
    if (confirmed.length || reverted)
      void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });
    return { confirmed, unresolved, reverted };
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
    const outcome =
      pending.confirmation !== "pending"
        ? { status: "confirmed" as const, transactionHash: pending.hash }
        : await reconcileTransaction(sender, pending, (hash) =>
            createClients(chainId).publicClient.getTransactionReceipt({ hash })
          );
    if (useActionRegistrationStore.getState().pending[registrationScope] !== pending)
      return { success: false, confirmation: "pending", hash: pending.hash };
    void queryClient.invalidateQueries({ queryKey: actionsKeys.byChain(chainId) });
    if (outcome.status === "confirmed") {
      useActionRegistrationStore.getState().record(address, chainId, {
        ...pending,
        hash: outcome.transactionHash,
        confirmation: undefined,
        successTracked: true,
      });
      if (pending.action && !pending.successTracked)
        trackAdminActionCreateSuccess({
          ...pending.action,
          gardenAddress: contracts.gardenToken,
          chainId,
          txHash: outcome.transactionHash,
        });
      scheduleBackgroundRefetch();
      return { success: true, hash: outcome.transactionHash };
    }
    if (outcome.status === "reverted") {
      if (pending.action)
        trackAdminActionCreateFailed({
          ...pending.action,
          gardenAddress: contracts.gardenToken,
          chainId,
          error: "TransactionReverted",
          parsedErrorFamily: "TransactionReverted",
        });
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

  const confirmRegistrationCancellation = async (confirmedInWallet: boolean) => {
    const pending = registrationScope
      ? useActionRegistrationStore.getState().pending[registrationScope]
      : undefined;
    await confirmCancelledSubmission({
      confirmedInWallet,
      account: address ?? undefined,
      sender,
      chainId,
      isCurrent: () =>
        Boolean(
          address &&
            registrationScope &&
            pending?.confirmation === "pending" &&
            activeRegistrationScope.current === registrationScope &&
            loadingCount.current === 0 &&
            useActionRegistrationStore.getState().pending[registrationScope] === pending
        ),
      clear: () => useActionRegistrationStore.getState().clear(address!, chainId),
    });
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
    buildConfig: () => ActionOperationCommand,
    registrationDetails?: ActionRegistrationDetails
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
    const fingerprint = fingerprintActionArguments(call.args);

    try {
      if (call.functionName === "registerAction" && registrationScope) {
        const pending = useActionRegistrationStore.getState().pending[registrationScope];
        if (pending) return { success: false, confirmation: "pending", hash: pending.hash };
      }
      if (editKey) {
        const edit = useActionRegistrationStore.getState().edits[editKey];
        if (edit && !edit.confirmed)
          return { success: false, confirmation: "pending", hash: edit.result.hash };
        // A past receipt is not proof that a new save is already applied.
        if (edit?.confirmed) useActionRegistrationStore.getState().clearEdit(editKey);
      }
      const result = await executeActionOperation(
        call,
        createDefaultActionOperationPorts({
          executeWithToast,
          transactionSender: sender,
          checkpoint: (_call, pending) => {
            if (call.functionName === "registerAction")
              useActionRegistrationStore
                .getState()
                .record(address, chainId, pending, registrationDetails);
            else if (editKey)
              useActionRegistrationStore.getState().recordEdit(editKey, fingerprint, pending);
          },
          clearCheckpoint: (_call, result) => {
            if (call.functionName === "registerAction" && result.confirmation !== "pending") return;
            const hash = result.broadcastReference?.hash ?? result.hash;
            const store = useActionRegistrationStore.getState();
            if (
              call.functionName === "registerAction" &&
              registrationScope &&
              store.pending[registrationScope]?.hash === hash
            )
              store.clear(address, chainId);
            else if (editKey && store.edits[editKey]?.result.hash === hash)
              store.clearEdit(editKey);
          },
        })
      );
      if (result.success && call.functionName === "registerAction" && result.hash) {
        useActionRegistrationStore
          .getState()
          .record(
            address,
            chainId,
            { hash: result.hash, sponsored: sender.supportsSponsorship, successTracked: true },
            registrationDetails
          );
        if (registrationDetails)
          trackAdminActionCreateSuccess({
            ...registrationDetails,
            gardenAddress: contracts.gardenToken,
            chainId,
            txHash: result.hash,
          });
      }
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
          useActionRegistrationStore
            .getState()
            .record(address, chainId, error.submission, registrationDetails);
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
    withTracking(
      () => ({
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
      }),
      { actionTitle: params.title, actionSlug: params.slug, actionDomain: params.domain }
    );

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

  const acknowledgeRegistration = (hash?: `0x${string}`) => {
    if (!address || !registrationScope || !hash) return;
    const pending = useActionRegistrationStore.getState().pending[registrationScope];
    if (pending?.hash === hash && pending.confirmation !== "pending")
      useActionRegistrationStore.getState().clear(address, chainId);
  };

  return {
    acknowledgeRegistration,
    assertReady,
    pendingRegistration,
    registrationScope,
    reconcileRegistration,
    confirmRegistrationCancellation,
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
