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
import { createGardenMachine } from "../../workflows/createGarden";

export function useCreateGardenWorkflow() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const addPendingTransaction = useAdminStore((state: AdminState) => state.addPendingTransaction);
  const updateTransactionStatus = useAdminStore(
    (state: AdminState) => state.updateTransactionStatus
  );

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

  const openFlow = useCallback(() => send({ type: "OPEN" }), [send]);
  const closeFlow = useCallback(() => send({ type: "CLOSE" }), [send]);
  const goNext = useCallback(() => send({ type: "NEXT" }), [send]);
  const goBack = useCallback(() => send({ type: "BACK" }), [send]);
  const goToReview = useCallback(() => send({ type: "REVIEW" }), [send]);
  const submitCreation = useCallback(() => send({ type: "SUBMIT" }), [send]);
  const retry = useCallback(() => send({ type: "RETRY" }), [send]);
  const edit = useCallback(() => send({ type: "EDIT" }), [send]);
  const createAnother = useCallback(() => send({ type: "CREATE_ANOTHER" }), [send]);

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
