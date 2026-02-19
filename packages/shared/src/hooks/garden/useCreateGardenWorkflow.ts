/**
 * Create Garden Workflow Hook
 *
 * Bridges the XState machine with the Zustand form store,
 * providing a clean API for the UI layer.
 *
 * @module hooks/garden/useCreateGardenWorkflow
 */

import { useMachine } from "@xstate/react";
import { useQueryClient } from "@tanstack/react-query";
import { waitForTransactionReceipt } from "@wagmi/core";
import { formatEther, isAddress } from "viem";
import { fromPromise } from "xstate";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import { wagmiConfig } from "../../config/appkit";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useCreateGardenStore } from "../../stores/useCreateGardenStore";
import {
  createClients,
  GardenTokenABI,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { createGardenMachine, type CreateGardenFormStatus } from "../../workflows/createGarden";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { useGardenDraft } from "./useGardenDraft";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";

export type { GardenDraft } from "./useGardenDraft";

/**
 * Estimate the CCIP fee for ENS registration during garden creation.
 * Returns 0n if slug is empty, ENS is not configured, or estimation fails.
 */
async function estimateCCIPFee(
  slug: string,
  ensAddress: `0x${string}`,
  callerAddress: `0x${string}`,
  chainId: number
): Promise<bigint> {
  if (!slug || !ensAddress || ensAddress === "0x0000000000000000000000000000000000000000") {
    return 0n;
  }

  try {
    const { publicClient } = createClients(chainId);
    return (await publicClient.readContract({
      address: ensAddress,
      abi: GreenGoodsENSABI,
      functionName: "getRegistrationFee",
      args: [slug, callerAddress, 1], // 1 = Garden NameType
    })) as bigint;
  } catch (error) {
    // ENS fee estimation failed -- proceed without ENS (graceful degradation)
    logger.warn("ENS fee estimation failed, proceeding without ENS", {
      source: "estimateCCIPFee",
      slug,
      ensAddress,
      chainId,
      error,
    });
    return 0n;
  }
}

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

  // Store mutable dependencies in refs so the machine actor can read
  // current values without recreating the machine on every change
  const walletClientRef = useRef(walletClient);
  const addressRef = useRef(address);
  const chainIdRef = useRef(selectedChainId);
  const addPendingTxRef = useRef(addPendingTransaction);
  const queryClientRef = useRef(queryClient);
  const storeNextStepRef = useRef(storeNextStep);
  const storePreviousStepRef = useRef(storePreviousStep);
  const storeGoToReviewRef = useRef(storeGoToReview);
  const storeGoToFirstIncompleteRef = useRef(storeGoToFirstIncomplete);

  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    chainIdRef.current = selectedChainId;
  }, [selectedChainId]);
  useEffect(() => {
    addPendingTxRef.current = addPendingTransaction;
  }, [addPendingTransaction]);
  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);
  useEffect(() => {
    storeNextStepRef.current = storeNextStep;
  }, [storeNextStep]);
  useEffect(() => {
    storePreviousStepRef.current = storePreviousStep;
  }, [storePreviousStep]);
  useEffect(() => {
    storeGoToReviewRef.current = storeGoToReview;
  }, [storeGoToReview]);
  useEffect(() => {
    storeGoToFirstIncompleteRef.current = storeGoToFirstIncomplete;
  }, [storeGoToFirstIncomplete]);

  const { start: scheduleGardenRefresh } = useDelayedInvalidation(
    useCallback(() => {
      queryInvalidation
        .invalidateGardens(chainIdRef.current)
        .forEach((queryKey) => queryClientRef.current.invalidateQueries({ queryKey }));
    }, []),
    INDEXER_LAG_FOLLOWUP_MS
  );
  const scheduleGardenRefreshRef = useRef(scheduleGardenRefresh);
  useEffect(() => {
    scheduleGardenRefreshRef.current = scheduleGardenRefresh;
  }, [scheduleGardenRefresh]);

  const machine = useMemo(
    () =>
      createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise<string, void>(async () => {
            const params = useCreateGardenStore.getState().getParams();
            if (!params) {
              throw new Error("Garden form is incomplete");
            }

            const currentWalletClient = walletClientRef.current;
            const currentAddress = addressRef.current;
            const currentChainId = chainIdRef.current;

            if (!currentWalletClient || !currentAddress || !isAddress(currentAddress)) {
              throw new Error("Connect a wallet to deploy the garden");
            }
            const accountAddress = currentAddress as `0x${string}`;

            trackAdminGardenCreateStarted({
              gardenName: params.name,
              chainId: currentChainId,
            });

            try {
              const contracts = getNetworkContracts(currentChainId);
              const config = {
                name: params.name,
                slug: params.slug ?? "",
                description: params.description,
                location: params.location,
                bannerImage: params.bannerImage,
                metadata: params.metadata ?? "",
                openJoining: params.openJoining ?? false,
                weightScheme: params.weightScheme,
                domainMask: params.domainMask,
              };

              // Estimate CCIP fee for ENS registration (if slug provided and ENS module configured)
              const ccipFee = await estimateCCIPFee(
                config.slug,
                contracts.greenGoodsENS as `0x${string}`,
                accountAddress,
                currentChainId
              );

              // Simulate first to catch contract reverts without spending gas
              const simulation = await simulateTransaction(
                contracts.gardenToken as `0x${string}`,
                GardenTokenABI,
                "mintGarden",
                [config],
                accountAddress
              );

              if (!simulation.success) {
                throw new Error(simulation.error?.message ?? "Transaction simulation failed");
              }

              // Execute the transaction (payable -- includes CCIP fee for ENS)
              const txHash = await currentWalletClient.writeContract({
                address: contracts.gardenToken as `0x${string}`,
                abi: GardenTokenABI,
                functionName: "mintGarden",
                account: accountAddress,
                args: [config],
                value: ccipFee,
              });

              addPendingTxRef.current(txHash, "garden:create");

              // Wait for on-chain confirmation before declaring success
              await waitForTransactionReceipt(wagmiConfig, {
                hash: txHash,
                chainId: currentChainId,
                timeout: TX_RECEIPT_TIMEOUT_MS,
              });

              trackAdminGardenCreateSuccess({
                gardenName: params.name,
                gardenAddress: contracts.gardenToken,
                chainId: currentChainId,
                txHash,
              });

              // Invalidate garden queries so the list updates immediately
              queryInvalidation
                .invalidateGardens(currentChainId)
                .forEach((queryKey) => queryClientRef.current.invalidateQueries({ queryKey }));
              // Schedule follow-up for indexer lag
              scheduleGardenRefreshRef.current();

              return txHash;
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
            storeNextStepRef.current();
          },
          goToPreviousStep: () => {
            storePreviousStepRef.current();
          },
          goToReviewStep: () => {
            storeGoToReviewRef.current();
          },
          goToFirstIncompleteStep: () => {
            storeGoToFirstIncompleteRef.current();
          },
        },
      }),
    [] // Machine created once — actors/actions read current values from refs
  );

  const [state, send] = useMachine(machine);
  const isSubmitting = state.matches("submitting") || isLockPending;
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
    storeReset();
    send({ type: "OPEN" });
  }, [send, storeReset]);

  const closeFlow = useCallback(() => {
    storeReset();
    void draft.clearDraft();
    send({ type: "CLOSE" });
  }, [send, storeReset, draft]);

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

  const submitCreation = useCallback(() => {
    if (state.matches("submitting")) {
      return;
    }
    void runWithLock(async () => {
      const formStatus = getFormStatus();
      send({ type: "SUBMIT", formStatus });
    });
  }, [send, state, runWithLock]);

  const estimateCreationCost = useCallback(async () => {
    const params = useCreateGardenStore.getState().getParams();
    if (!params) {
      throw new Error("Garden form is incomplete");
    }

    const currentAddress = addressRef.current;
    const currentChainId = chainIdRef.current;

    if (!currentAddress || !isAddress(currentAddress)) {
      throw new Error("Connect a wallet to estimate deployment cost");
    }
    const accountAddress = currentAddress as `0x${string}`;

    const contracts = getNetworkContracts(currentChainId);
    const config = {
      name: params.name,
      slug: params.slug ?? "",
      description: params.description,
      location: params.location,
      bannerImage: params.bannerImage,
      metadata: params.metadata ?? "",
      openJoining: params.openJoining ?? false,
      weightScheme: params.weightScheme,
      domainMask: params.domainMask,
    };

    const { publicClient } = createClients(currentChainId);

    const ccipFee = await estimateCCIPFee(
      config.slug,
      contracts.greenGoodsENS as `0x${string}`,
      accountAddress,
      currentChainId
    );

    const gasEstimate = await publicClient.estimateContractGas({
      address: contracts.gardenToken as `0x${string}`,
      abi: GardenTokenABI,
      functionName: "mintGarden",
      account: accountAddress,
      args: [config],
      value: ccipFee,
    });

    const gasPrice = await publicClient.getGasPrice();
    const txFee = gasEstimate * gasPrice;
    const totalEstimatedFee = txFee + ccipFee;

    return {
      gasEstimate,
      gasPrice,
      txFee,
      ccipFee,
      totalEstimatedFee,
      formatted: {
        txFeeEth: formatEther(txFee),
        ccipFeeEth: formatEther(ccipFee),
        totalEth: formatEther(totalEstimatedFee),
      },
    };
  }, []);

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const edit = useCallback(() => {
    send({ type: "EDIT" });
  }, [send]);

  const createAnother = useCallback(() => {
    storeReset();
    void draft.clearDraft();
    send({ type: "CREATE_ANOTHER" });
  }, [send, storeReset, draft]);

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
    edit,
    createAnother,
    draft,
  };
}
