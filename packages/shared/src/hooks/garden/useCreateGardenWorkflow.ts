/**
 * Create Garden Workflow Hook
 *
 * Bridges the XState machine with the Zustand form store,
 * providing a clean API for the UI layer.
 *
 * @module hooks/garden/useCreateGardenWorkflow
 */

import { useQueryClient } from "@tanstack/react-query";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { formatEther, isAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { fromPromise } from "xstate";
import { wagmiConfig } from "../../config/appkit";
import { getChain } from "../../config/chains";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { isZeroAddress } from "../../utils/blockchain/address";
import {
  createClients,
  GardenTokenABI,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { type CreateGardenFormStatus, createGardenMachine } from "../../workflows/createGarden";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { useGardenDraft } from "./useGardenDraft";

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
  if (!slug || isZeroAddress(ensAddress)) {
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

  // Keep mutable dependencies current for the long-lived machine actor/actions.
  const dependenciesRef = useRef({
    walletClient,
    address,
    chainId: selectedChainId,
    addPendingTransaction,
    queryClient,
    storeNextStep,
    storePreviousStep,
    storeGoToReview,
    storeGoToFirstIncomplete,
    scheduleGardenRefresh: () => {},
  });

  const { start: scheduleGardenRefresh } = useDelayedInvalidation(
    useCallback(() => {
      const { chainId, queryClient: latestQueryClient } = dependenciesRef.current;
      queryInvalidation
        .invalidateGardens(chainId)
        .forEach((queryKey) => latestQueryClient.invalidateQueries({ queryKey }));
    }, []),
    INDEXER_LAG_FOLLOWUP_MS
  );

  useEffect(() => {
    dependenciesRef.current = {
      ...dependenciesRef.current,
      walletClient,
      address,
      chainId: selectedChainId,
      addPendingTransaction,
      queryClient,
      storeNextStep,
      storePreviousStep,
      storeGoToReview,
      storeGoToFirstIncomplete,
      scheduleGardenRefresh,
    };
  }, [
    walletClient,
    address,
    selectedChainId,
    addPendingTransaction,
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
          submitGarden: fromPromise<string, void>(async () => {
            const gardenStoreState = useCreateGardenStore.getState();
            const params = gardenStoreState.getParams();
            if (!params) {
              throw new Error("Garden form is incomplete");
            }

            const {
              walletClient: currentWalletClient,
              address: currentAddress,
              chainId: currentChainId,
              addPendingTransaction: addPendingTx,
              queryClient: latestQueryClient,
              scheduleGardenRefresh: scheduleRefresh,
            } = dependenciesRef.current;

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
                gardeners: params.gardeners,
                operators: params.operators,
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
                accountAddress,
                currentChainId
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
                chain: getChain(currentChainId),
              });

              addPendingTx(txHash, "garden:create");

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
                .forEach((queryKey) => latestQueryClient.invalidateQueries({ queryKey }));
              // Schedule follow-up for indexer lag
              scheduleRefresh();

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
    send({ type: "OPEN" });
  }, [send]);

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

    const currentAddress = dependenciesRef.current.address;
    const currentChainId = dependenciesRef.current.chainId;

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
      gardeners: params.gardeners,
      operators: params.operators,
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
