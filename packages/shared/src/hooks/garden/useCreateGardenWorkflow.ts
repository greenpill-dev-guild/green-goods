/**
 * Create Garden Workflow Hook
 *
 * Bridges the XState machine with the Zustand form store,
 * providing a clean API for the UI layer.
 *
 * @module hooks/garden/useCreateGardenWorkflow
 */

import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { GardenTokenABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { createGardenMachine, type CreateGardenFormStatus } from "../../workflows/createGarden";

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
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const addPendingTransaction = useAdminStore((state: AdminState) => state.addPendingTransaction);
  const updateTransactionStatus = useAdminStore(
    (state: AdminState) => state.updateTransactionStatus
  );

  // Get store actions for step navigation
  const storeNextStep = useCreateGardenStore((s) => s.nextStep);
  const storePrevStep = useCreateGardenStore((s) => s.previousStep);
  const storeGoToReview = useCreateGardenStore((s) => s.goToReview);
  const storeGoToFirstIncomplete = useCreateGardenStore((s) => s.goToFirstIncompleteStep);
  const storeReset = useCreateGardenStore((s) => s.reset);

  const machine = useMemo(
    () =>
      createGardenMachine.provide({
        actors: {
          submitGarden: async () => {
            const params = useCreateGardenStore.getState().getParams();
            if (!params) {
              throw new Error("Garden form is incomplete");
            }

            if (!walletClient || !address) {
              throw new Error("Connect a wallet to deploy the garden");
            }

            // Track garden creation started
            trackAdminGardenCreateStarted({
              gardenName: params.name,
              chainId: selectedChainId,
            });

            try {
              const contracts = getNetworkContracts(selectedChainId);
              const txHash = await walletClient.writeContract({
                address: contracts.gardenToken as `0x${string}`,
                abi: GardenTokenABI,
                functionName: "mintGarden",
                account: address,
                args: [
                  params.communityToken,
                  params.name,
                  params.description,
                  params.location,
                  params.bannerImage,
                  params.gardeners,
                  params.gardenOperators,
                ],
              });

              // Track garden creation success
              trackAdminGardenCreateSuccess({
                gardenName: params.name,
                gardenAddress: contracts.gardenToken, // Note: actual garden address comes from event
                chainId: selectedChainId,
                txHash,
              });

              addPendingTransaction(txHash, "garden:create");
              return txHash;
            } catch (error) {
              // Track garden creation failure
              trackAdminGardenCreateFailed({
                gardenName: params.name,
                chainId: selectedChainId,
                error: error instanceof Error ? error.message : "Unknown error",
              });
              throw error;
            }
          },
        },
      } as any),
    [address, walletClient, selectedChainId, addPendingTransaction]
  );

  const [state, send] = useMachine(machine);

  useEffect(() => {
    if (state.value === "success" && state.context.txHash) {
      updateTransactionStatus(state.context.txHash, "confirmed");
    }
  }, [state.value, state.context.txHash, updateTransactionStatus]);

  // Navigation handlers that bridge store and machine
  const openFlow = useCallback(() => {
    storeReset();
    send({ type: "OPEN" });
  }, [send, storeReset]);

  const closeFlow = useCallback(() => {
    storeReset();
    send({ type: "CLOSE" });
  }, [send, storeReset]);

  const goNext = useCallback(() => {
    const formStatus = getFormStatus();
    if (formStatus.canProceed) {
      // Only advance store if machine will accept the event
      storeNextStep();
    }
    send({ type: "NEXT", formStatus });
  }, [send, storeNextStep]);

  const goBack = useCallback(() => {
    const formStatus = getFormStatus();
    if (formStatus.currentStep > 0) {
      storePrevStep();
    }
    send({ type: "BACK", formStatus });
  }, [send, storePrevStep]);

  const goToReview = useCallback(() => {
    const formStatus = getFormStatus();
    if (formStatus.isReviewReady) {
      storeGoToReview();
    }
    send({ type: "REVIEW", formStatus });
  }, [send, storeGoToReview]);

  const submitCreation = useCallback(() => {
    const formStatus = getFormStatus();
    send({ type: "SUBMIT", formStatus });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const edit = useCallback(() => {
    storeGoToFirstIncomplete();
    send({ type: "EDIT" });
  }, [send, storeGoToFirstIncomplete]);

  const createAnother = useCallback(() => {
    storeReset();
    send({ type: "CREATE_ANOTHER" });
  }, [send, storeReset]);

  return {
    state,
    openFlow,
    closeFlow,
    goNext,
    goBack,
    goToReview,
    submitCreation,
    retry,
    edit,
    createAnother,
  };
}
