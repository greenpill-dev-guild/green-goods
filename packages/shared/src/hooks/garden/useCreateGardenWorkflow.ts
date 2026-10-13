import { reconcileGardenRecovery } from "./gardenRecovery";
import { confirmCancelledSubmission } from "../../modules/transactions/cancelled-submission";
import { useQueryClient } from "@tanstack/react-query";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { isAddress } from "viem";
import { getTransactionScopeKey, type TxResult } from "../../modules/transactions/types";
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
  useLayoutEffect(() => {
    if (address) useCreateGardenStore.getState().selectDraftScope(address, selectedChainId);
  }, [address, selectedChainId]);
  // Draft persistence via IndexedDB (auto-saves on store changes)
  const draft = useGardenDraft(address, { enabled: !!address, chainId: selectedChainId });
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
          reconcileGarden: fromPromise<TxResult, TxResult>(({ input, signal }) =>
            reconcileGardenRecovery(input, signal, () => dependenciesRef.current)
          ),
          submitGarden: fromPromise<TxResult, void>(async () => {
            const gardenStoreState = useCreateGardenStore.getState();
            const { address: activeAddress, chainId: activeChainId } = dependenciesRef.current;
            const existing = activeAddress
              ? gardenStoreState.getPendingSubmission(activeAddress, activeChainId)
              : undefined;
            if (existing?.result.confirmation === "pending") return existing.result;
            if (existing)
              throw new Error(
                dependenciesRef.current.formatMessage({ id: "app.garden.previousCreationComplete" })
              );
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
                checkpoint: (result) =>
                  useCreateGardenStore.getState().recordPendingSubmission({
                    accountAddress,
                    chainId: currentChainId,
                    result,
                    gardenName: params.name,
                  }),
                clearCheckpoint: (result) => {
                  // A successful send remains recoverable until its draft is consumed.
                  if (result.confirmation !== "pending") return;
                  const store = useCreateGardenStore.getState();
                  if (
                    store.getPendingSubmission(accountAddress, currentChainId)?.result.hash ===
                    (result.broadcastReference?.hash ?? result.hash)
                  )
                    store.clearPendingSubmission(accountAddress, currentChainId);
                },
              });
              const result = await createGarden(
                { params, accountAddress, chainId: currentChainId },
                ports
              );
              if (result.confirmation === "pending") {
                useCreateGardenStore.getState().recordPendingSubmission({
                  accountAddress,
                  chainId: currentChainId,
                  result,
                  gardenName: params.name,
                });
                return result;
              }
              const txHash = result.hash;
              const pending = useCreateGardenStore
                .getState()
                .getPendingSubmission(accountAddress, currentChainId);
              useCreateGardenStore.getState().recordPendingSubmission({
                accountAddress,
                chainId: currentChainId,
                gardenName: params.name,
                result,
                successTracked: true,
              });
              const contracts = getNetworkContracts(currentChainId);
              if (!pending?.successTracked)
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
  const [state, send, actor] = useMachine(machine);
  const scope = address ? getTransactionScopeKey(address, selectedChainId) : null;
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    send({ type: "SWITCH_SCOPE" });
    if (!address) return;
    send({ type: "OPEN" });
    const pending = useCreateGardenStore.getState().getPendingSubmission(address, selectedChainId);
    if (pending) send({ type: "RESTORE_PENDING", submission: pending.result });
    else {
      const formStatus = getFormStatus();
      if (formStatus.isReviewReady) send({ type: "REVIEW", formStatus });
    }
  }, [scope, address, selectedChainId, send]);
  const isSubmitting =
    state.matches("submitting") ||
    state.matches("pending") ||
    state.matches("reconciling") ||
    isLockPending;
  useBeforeUnloadWhilePending(isSubmitting);
  useEffect(() => {
    if (state.value === "success" && state.context.txHash) {
      updateTransactionStatus(state.context.txHash, "confirmed");
      // Screen cancellation cannot lose an accepted operation. Consume only this scope.
      const pending = address
        ? useCreateGardenStore.getState().getPendingSubmission(address, selectedChainId)
        : undefined;
      if (pending && pending.result.hash === state.context.txHash) {
        void draft.clearDraft().then(async (cleared) => {
          if (!cleared || (await draft.peekDraft())) return;
          const store = useCreateGardenStore.getState();
          if (store.getPendingSubmission(pending.accountAddress, pending.chainId) === pending)
            store.clearPendingSubmission(pending.accountAddress, pending.chainId);
        });
      }
    }
  }, [state.value, state.context.txHash, updateTransactionStatus, draft, address, selectedChainId]);
  // Navigation handlers that bridge store and machine
  const openFlow = useCallback(() => {
    send({ type: "OPEN" });
    const { address: currentAddress, chainId } = dependenciesRef.current;
    const pending = currentAddress
      ? useCreateGardenStore.getState().getPendingSubmission(currentAddress, chainId)
      : undefined;
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
    const snapshot = actor.getSnapshot();
    if (snapshot.matches("submitting")) {
      logger.warn("submitCreation called while already submitting", {
        source: "useCreateGardenWorkflow.submitCreation",
        machineState: snapshot.value,
      });
      return false;
    }
    const formStatus = getFormStatus();
    // The one-page form has no Next button. Use the machine's guarded review
    // transition, then read its live snapshot rather than a previous render.
    if (snapshot.matches("collecting")) send({ type: "REVIEW", formStatus });
    const machineState = actor.getSnapshot().value;
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
  }, [send, actor, runWithLock]);
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
    const { address: activeAddress, chainId: activeChainId } = dependenciesRef.current;
    const store = useCreateGardenStore.getState();
    const completed = activeAddress
      ? store.getPendingSubmission(activeAddress, activeChainId)
      : undefined;
    if (activeAddress && completed && completed.result.confirmation !== "pending")
      store.clearPendingSubmission(activeAddress, activeChainId);
    storeReset();
    void draft.clearDraft();
    send({ type: "CREATE_ANOTHER" });
  }, [send, storeReset, draft, state]);

  const checkConfirmation = useCallback(() => send({ type: "CHECK_CONFIRMATION" }), [send]);

  const confirmWalletCancellation = async (confirmedInWallet: boolean) => {
    const { address: account, sender, chainId } = dependenciesRef.current;
    const pending = account
      ? useCreateGardenStore.getState().getPendingSubmission(account, chainId)
      : undefined;
    await confirmCancelledSubmission({
      confirmedInWallet,
      account,
      sender,
      chainId,
      isCurrent: () =>
        Boolean(
          account &&
            pending?.result.confirmation === "pending" &&
            actor.getSnapshot().matches("pending") &&
            dependenciesRef.current.address === account &&
            dependenciesRef.current.chainId === chainId &&
            useCreateGardenStore.getState().getPendingSubmission(account, chainId) === pending
        ),
      clear: () => {
        useCreateGardenStore.getState().clearPendingSubmission(account!, chainId);
        send({ type: "SWITCH_SCOPE" });
        openFlow();
      },
    });
  };
  return {
    recoveryKey: `${scope}:${state.context.txHash}`,
    confirmWalletCancellation,
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
