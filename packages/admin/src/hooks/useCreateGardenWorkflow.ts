import { useCallback, useEffect, useMemo } from "react";
import { useMachine } from "@xstate/react";
import { useAccount, useWalletClient } from "wagmi";
import { toast } from "react-hot-toast";

import { createGardenMachine } from "@/workflows/createGarden";
import { getNetworkContracts, GardenTokenABI } from "@/utils/contracts";
import { useAdminStore } from "@/stores/admin";
import { useCreateGardenStore } from "@/stores/createGarden";

export function useCreateGardenWorkflow() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const addPendingTransaction = useAdminStore((state) => state.addPendingTransaction);
  const updateTransactionStatus = useAdminStore((state) => state.updateTransactionStatus);

  const machine = useMemo(
    () =>
      createGardenMachine.provide({
        services: {
          submitGarden: async () => {
            const params = useCreateGardenStore.getState().getParams();
            if (!params) {
              throw new Error("Garden form is incomplete");
            }

            if (!walletClient || !address) {
              throw new Error("Connect a wallet to deploy the garden");
            }

            const contracts = getNetworkContracts(selectedChainId);
            const txHash = await walletClient.writeContract({
              address: contracts.gardenToken as `0x${string}`,
              abi: GardenTokenABI.abi,
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

            addPendingTransaction(txHash, "garden:create");
            return txHash;
          },
        },
      }),
    [address, walletClient, selectedChainId, addPendingTransaction]
  );

  const [state, send] = useMachine(machine);

  useEffect(() => {
    if (state.matches("success") && state.context.txHash) {
      updateTransactionStatus(state.context.txHash, "confirmed");
      toast.success("Garden deployment transaction confirmed");
    }
    if (state.matches("error") && state.context.error) {
      toast.error(state.context.error);
    }
  }, [state.value, state.context.txHash, state.context.error, updateTransactionStatus]);

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
