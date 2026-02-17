/**
 * Create Garden Workflow Hook
 *
 * Bridges the XState machine with the Zustand form store,
 * providing a clean API for the UI layer.
 *
 * @module hooks/garden/useCreateGardenWorkflow
 */

import { useMachine } from "@xstate/react";
import { waitForTransactionReceipt } from "@wagmi/core";
import { formatEther } from "viem";
import { fromPromise } from "xstate";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  trackAdminGardenCreateFailed,
  trackAdminGardenCreateStarted,
  trackAdminGardenCreateSuccess,
} from "../../modules/app/analytics-events";
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
  const storeGoToReview = useCreateGardenStore((s) => s.goToReview);
  const storeGoToFirstIncomplete = useCreateGardenStore((s) => s.goToFirstIncompleteStep);
  const storeReset = useCreateGardenStore((s) => s.reset);

  // Store mutable dependencies in refs so the machine actor can read
  // current values without recreating the machine on every change
  const walletClientRef = useRef(walletClient);
  const addressRef = useRef(address);
  const chainIdRef = useRef(selectedChainId);
  const addPendingTxRef = useRef(addPendingTransaction);

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

            if (!currentWalletClient || !currentAddress) {
              throw new Error("Connect a wallet to deploy the garden");
            }

            trackAdminGardenCreateStarted({
              gardenName: params.name,
              chainId: currentChainId,
            });

            try {
              const contracts = getNetworkContracts(currentChainId);
              const config = {
                communityToken: params.communityToken,
                name: params.name,
                slug: params.slug ?? "",
                description: params.description,
                location: params.location,
                bannerImage: params.bannerImage,
                metadata: params.metadata ?? "",
                openJoining: params.openJoining ?? false,
              };

              // Estimate CCIP fee for ENS registration (if slug provided and ENS module configured)
              let ccipFee = 0n;
              const ensAddress = contracts.greenGoodsENS as `0x${string}`;
              if (
                config.slug &&
                ensAddress &&
                ensAddress !== "0x0000000000000000000000000000000000000000"
              ) {
                try {
                  const { publicClient } = createClients(currentChainId);
                  ccipFee = (await publicClient.readContract({
                    address: ensAddress,
                    abi: GreenGoodsENSABI,
                    functionName: "getRegistrationFee",
                    args: [config.slug, currentAddress, 1], // 1 = Garden NameType
                  })) as bigint;
                } catch {
                  // ENS fee estimation failed -- proceed without ENS (graceful degradation)
                  ccipFee = 0n;
                }
              }

              // Simulate first to catch contract reverts without spending gas
              const simulation = await simulateTransaction(
                contracts.gardenToken as `0x${string}`,
                GardenTokenABI,
                "mintGarden",
                [config],
                currentAddress
              );

              if (!simulation.success) {
                throw new Error(simulation.error?.message ?? "Transaction simulation failed");
              }

              // Execute the transaction (payable -- includes CCIP fee for ENS)
              const txHash = await currentWalletClient.writeContract({
                address: contracts.gardenToken as `0x${string}`,
                abi: GardenTokenABI,
                functionName: "mintGarden",
                account: currentAddress,
                args: [config],
                value: ccipFee,
              });

              addPendingTxRef.current(txHash, "garden:create");

              // Wait for on-chain confirmation before declaring success
              await waitForTransactionReceipt(wagmiConfig, {
                hash: txHash,
                chainId: currentChainId,
              });

              trackAdminGardenCreateSuccess({
                gardenName: params.name,
                gardenAddress: contracts.gardenToken,
                chainId: currentChainId,
                txHash,
              });

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
      }),
    [] // Machine created once — actor reads current values from refs
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
    send({ type: "NEXT", formStatus });
  }, [send]);

  const goBack = useCallback(() => {
    const formStatus = getFormStatus();
    send({ type: "BACK", formStatus });
  }, [send]);

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

  const estimateCreationCost = useCallback(async () => {
    const params = useCreateGardenStore.getState().getParams();
    if (!params) {
      throw new Error("Garden form is incomplete");
    }

    const currentAddress = addressRef.current;
    const currentChainId = chainIdRef.current;

    if (!currentAddress) {
      throw new Error("Connect a wallet to estimate deployment cost");
    }

    const contracts = getNetworkContracts(currentChainId);
    const config = {
      communityToken: params.communityToken,
      name: params.name,
      slug: params.slug ?? "",
      description: params.description,
      location: params.location,
      bannerImage: params.bannerImage,
      metadata: params.metadata ?? "",
      openJoining: params.openJoining ?? false,
    };

    const { publicClient } = createClients(currentChainId);

    let ccipFee = 0n;
    const ensAddress = contracts.greenGoodsENS as `0x${string}`;
    if (config.slug && ensAddress && ensAddress !== "0x0000000000000000000000000000000000000000") {
      try {
        ccipFee = (await publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "getRegistrationFee",
          args: [config.slug, currentAddress, 1],
        })) as bigint;
      } catch {
        ccipFee = 0n;
      }
    }

    const gasEstimate = await publicClient.estimateContractGas({
      address: contracts.gardenToken as `0x${string}`,
      abi: GardenTokenABI,
      functionName: "mintGarden",
      account: currentAddress,
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
    estimateCreationCost,
    retry,
    edit,
    createAnother,
  };
}
