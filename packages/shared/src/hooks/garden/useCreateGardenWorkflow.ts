/**
 * Create Garden Workflow Hook
 *
 * Bridges the XState machine with the Zustand form store,
 * providing a clean API for the UI layer.
 *
 * @module hooks/garden/useCreateGardenWorkflow
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { isAddress } from "viem";
import { TransactionRevertedError, type TxResult } from "../../modules/transactions/types";
import { useIntl } from "react-intl";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { fromPromise } from "xstate";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import {
  createDefaultCreateGardenPorts,
  createGarden,
  estimateGardenCreation,
} from "../../modules/garden/create-garden-command";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { type CreateGardenFormStatus, createGardenMachine } from "../../workflows/createGarden";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useGardenDraft } from "./useGardenDraft";

export type { GardenDraft } from "./useGardenDraft";

/**
 * Get current form status from the store for passing to machine events
 */
function getFormStatus(): CreateGardenFormStatus {
  const state = useCreateGardenStore.getState();
  return {
    canProceed: state.canProceed(),
    isReviewReady: state.isReviewReady(),
    isOnReviewStep: state.currentStep === state.steps.length - 1,
    currentStep: state.currentStep,
    totalSteps: state.steps.length,
  };
}

export function useCreateGardenWorkflow() {
  const address = usePrimaryAddress() ?? undefined;
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const addPendingTransaction = useAdminStore((state: AdminState) => state.addPendingTransaction);
  const updateTransactionStatus = useAdminStore(
    (state: AdminState) => state.updateTransactionStatus
  );

  // Draft persistence via IndexedDB (auto-saves on store changes)
  const draft = useGardenDraft(address, { enabled: !!address });

  // Get store actions for step navigation
  const storeNextStep = useCreateGardenStore((s) => s.nextStep);
  const storePreviousStep = useCreateGardenStore((s) => s.previousStep);
  const storeGoToReview = useCreateGardenStore((s) => s.goToReview);
  const storeGoToFirstIncomplete = useCreateGardenStore((s) => s.goToFirstIncompleteStep);
  const storeReset = useCreateGardenStore((s) => s.reset);

  const queryClient = useQueryClient();
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  // Keep mutable dependencies current for the long-lived machine actor/actions.
  const dependenciesRef = useRef({
    address,
    sender,
    formatMessage,
    chainId: selectedChainId,
    addPendingTransaction,
    updateTransactionStatus,
    queryClient,
    storeNextStep,
    storePreviousStep,
    storeGoToReview,
    storeGoToFirstIncomplete,
    scheduleGardenRefresh: () => {},
  });

  const { start: scheduleGardenRefresh } = useProgressiveInvalidation(
    useCallback(() => {
      const { chainId, queryClient: latestQueryClient } = dependenciesRef.current;
      queryInvalidation
        .invalidateGardens(chainId)
        .forEach((queryKey) => latestQueryClient.invalidateQueries({ queryKey }));
    }, []),
    INDEXER_LAG_SCHEDULE_MS
  );

  useEffect(() => {
    dependenciesRef.current = {
      ...dependenciesRef.current,
      address,
      sender,
      formatMessage,
      chainId: selectedChainId,
      addPendingTransaction,
      updateTransactionStatus,
      queryClient,
      storeNextStep,
      storePreviousStep,
      storeGoToReview,
      storeGoToFirstIncomplete,
      scheduleGardenRefresh,
    };
  }, [
    address,
    sender,
    formatMessage,
    selectedChainId,
    addPendingTransaction,
    updateTransactionStatus,
    queryClient,
    storeNextStep,
    storePreviousStep,
    storeGoToReview,
    storeGoToFirstIncomplete,
    scheduleGardenRefresh,
  ]);

  const machine = useMemo(
    () =>
      createGardenMachine.provide({
        actors: {
          reconcileGarden: fromPromise<TxResult, TxResult>(async ({ input }) => {
            const pending = useCreateGardenStore.getState().pendingSubmission;
            const { address: currentAddress, sender: currentSender } = dependenciesRef.current;
            if (
              !pending ||
              !currentSender ||
              currentAddress?.toLowerCase() !== pending.accountAddress.toLowerCase()
            )
              return input;
            const ports = createDefaultCreateGardenPorts({
              transactionSender: currentSender,
              addPending: () => {},
            });
            const outcome = await ports.sender.reconcile(pending.result.hash, pending.chainId);
            if (
              useCreateGardenStore.getState().pendingSubmission !== pending ||
              dependenciesRef.current.address?.toLowerCase() !==
                pending.accountAddress.toLowerCase()
            )
              return input;
            if (outcome.status === "unresolved") return input;
            if (outcome.status === "reverted") {
              dependenciesRef.current.updateTransactionStatus(pending.result.hash, "failed");
              useCreateGardenStore.setState({ pendingSubmission: undefined });
              throw new TransactionRevertedError(
                pending.result.hash,
                "Garden creation transaction reverted"
              );
            }
            if (outcome.status !== "confirmed") return input;
            dependenciesRef.current.updateTransactionStatus(pending.result.hash, "confirmed");
            trackAdminGardenCreateSuccess({
              gardenName: pending.gardenName,
              gardenAddress: getNetworkContracts(pending.chainId).gardenToken,
              chainId: pending.chainId,
              txHash: outcome.transactionHash,
            });
            queryInvalidation
              .invalidateGardens(pending.chainId)
              .forEach((queryKey) =>
                dependenciesRef.current.queryClient.invalidateQueries({ queryKey })
              );
            dependenciesRef.current.scheduleGardenRefresh();
            useCreateGardenStore.setState({ pendingSubmission: undefined });
            return { hash: outcome.transactionHash, sponsored: input.sponsored };
          }),
          submitGarden: fromPromise<TxResult, void>(async () => {
            const gardenStoreState = useCreateGardenStore.getState();
            if (gardenStoreState.pendingSubmission)
              return gardenStoreState.pendingSubmission.result;
            const params = gardenStoreState.getParams();
            if (!params) {
              throw new Error("Garden form is incomplete");
            }

            const {
              address: currentAddress,
              sender: currentSender,
              formatMessage: message,
              chainId: currentChainId,
              addPendingTransaction: addPendingTx,
              queryClient: latestQueryClient,
              scheduleGardenRefresh: scheduleRefresh,
            } = dependenciesRef.current;

            if (!currentAddress || !isAddress(currentAddress)) {
              throw new Error(message({ id: "app.account.signInRequired" }));
            }
            if (!currentSender) throw new Error(message({ id: "app.account.signerNotReady" }));
            await currentSender.assertOwnership?.(currentAddress, currentChainId);
            const accountAddress = currentAddress as `0x${string}`;

            trackAdminGardenCreateStarted({
              gardenName: params.name,
              chainId: currentChainId,
            });

            try {
              const ports = createDefaultCreateGardenPorts({
                transactionSender: currentSender,
                addPending: (hash) => addPendingTx(hash, "garden:create"),
              });
              const result = await createGarden(
                { params, accountAddress, chainId: currentChainId },
                ports
              );
              if (result.confirmation === "pending") {
                useCreateGardenStore.setState({
                  pendingSubmission: {
                    accountAddress,
                    chainId: currentChainId,
                    result,
                    gardenName: params.name,
                  },
                });
                return result;
              }
              const txHash = result.hash;
              const contracts = getNetworkContracts(currentChainId);

              trackAdminGardenCreateSuccess({
                gardenName: params.name,
                gardenAddress: contracts.gardenToken,
                chainId: currentChainId,
                txHash,
              });

              // Invalidate garden queries so the list updates immediately
              queryInvalidation
                .invalidateGardens(currentChainId)
                .forEach((queryKey) => latestQueryClient.invalidateQueries({ queryKey }));
              // Schedule follow-up for indexer lag
              scheduleRefresh();

              return result;
            } catch (error) {
              trackAdminGardenCreateFailed({
                gardenName: params.name,
                chainId: currentChainId,
                error: error instanceof Error ? error.message : "Unknown error",
              });
              throw error;
            }
          }),
        },
        actions: {
          goToNextStep: () => {
            dependenciesRef.current.storeNextStep();
          },
          goToPreviousStep: () => {
            dependenciesRef.current.storePreviousStep();
          },
          goToReviewStep: () => {
            dependenciesRef.current.storeGoToReview();
          },
          goToFirstIncompleteStep: () => {
            dependenciesRef.current.storeGoToFirstIncomplete();
          },
        },
      }),
    [] // Machine created once — actors/actions read current values from refs
  );

  const [state, send] = useMachine(machine);
  const isSubmitting =
    state.matches("submitting") ||
    state.matches("pending") ||
    state.matches("reconciling") ||
    isLockPending;
  useBeforeUnloadWhilePending(isSubmitting);

  useEffect(() => {
    if (state.value === "success" && state.context.txHash) {
      updateTransactionStatus(state.context.txHash, "confirmed");
      // Clear draft on successful garden creation
      void draft.clearDraft();
    }
  }, [state.value, state.context.txHash, updateTransactionStatus, draft]);

  // Navigation handlers that bridge store and machine
  const openFlow = useCallback(() => {
    send({ type: "OPEN" });
    const pending = useCreateGardenStore.getState().pendingSubmission;
    const { address: currentAddress, chainId } = dependenciesRef.current;
    if (
      pending &&
      currentAddress?.toLowerCase() === pending.accountAddress.toLowerCase() &&
      chainId === pending.chainId
    ) {
      send({ type: "RESTORE_PENDING", submission: pending.result });
    }
  }, [send]);

  const closeFlow = useCallback(() => {
    if (isSubmitting) return;
    storeReset();
    void draft.clearDraft();
    send({ type: "CLOSE" });
  }, [send, storeReset, draft, isSubmitting]);

  const goNext = useCallback(() => {
    const formStatus = getFormStatus();
    send({ type: "NEXT", formStatus });
  }, [send]);

  const goBack = useCallback(() => {
    const formStatus = getFormStatus();
    send({ type: "BACK", formStatus });
  }, [send]);

  const goToReview = useCallback(() => {
    const formStatus = getFormStatus();
    send({ type: "REVIEW", formStatus });
  }, [send]);

  const submitCreation = useCallback((): boolean => {
    const machineState = state.value;
    if (state.matches("submitting")) {
      logger.warn("submitCreation called while already submitting", {
        source: "useCreateGardenWorkflow.submitCreation",
        machineState,
      });
      return false;
    }

    const formStatus = getFormStatus();

    // Pre-flight check: catch guard failures before XState silently drops the event
    if (machineState !== "review") {
      logger.error("Cannot submit: machine not in review state", {
        source: "useCreateGardenWorkflow.submitCreation",
        machineState,
        formStatus,
      });
      return false;
    }
    if (!formStatus.isReviewReady) {
      logger.error("Cannot submit: form not review-ready", {
        source: "useCreateGardenWorkflow.submitCreation",
        machineState,
        formStatus,
      });
      return false;
    }

    logger.info("Submitting garden creation", {
      source: "useCreateGardenWorkflow.submitCreation",
      machineState,
      formStatus,
    });

    void runWithLock(async () => {
      send({ type: "SUBMIT", formStatus });
    });
    return true;
  }, [send, state, runWithLock]);

  const estimateCreationCost = useCallback(async () => {
    const params = useCreateGardenStore.getState().getParams();
    if (!params) {
      throw new Error("Garden form is incomplete");
    }

    const {
      address: currentAddress,
      sender: currentSender,
      formatMessage: message,
    } = dependenciesRef.current;
    const currentChainId = dependenciesRef.current.chainId;

    if (!currentAddress || !isAddress(currentAddress)) {
      throw new Error(message({ id: "app.account.signInRequired" }));
    }
    const accountAddress = currentAddress as `0x${string}`;

    if (!currentSender) throw new Error(message({ id: "app.account.signerNotReady" }));
    const ports = createDefaultCreateGardenPorts({
      transactionSender: currentSender,
      addPending: () => {},
    });
    return estimateGardenCreation(
      { params, accountAddress, chainId: currentChainId },
      { reader: ports.reader }
    );
  }, []);

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const edit = useCallback(() => {
    send({ type: "EDIT" });
  }, [send]);

  const createAnother = useCallback(() => {
    if (!state.matches("success")) return;
    storeReset();
    void draft.clearDraft();
    send({ type: "CREATE_ANOTHER" });
  }, [send, storeReset, draft, state]);

  const checkConfirmation = useCallback(() => send({ type: "CHECK_CONFIRMATION" }), [send]);

  return {
    state,
    openFlow,
    closeFlow,
    goNext,
    goBack,
    goToReview,
    submitCreation,
    estimateCreationCost,
    retry,
    checkConfirmation,
    edit,
    createAnother,
    draft,
  };
}
