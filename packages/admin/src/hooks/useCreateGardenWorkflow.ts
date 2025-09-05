import { useMachine } from "@xstate/react";
import { useAccount, useWalletClient } from "wagmi";
import { createGardenMachine } from "@/workflows/createGarden";
import { getNetworkContracts, GardenTokenABI } from "@/utils/contracts";
import { useAdminStore } from "@/stores/admin";
import type { CreateGardenParams } from "@/types/contracts";

export function useCreateGardenWorkflow() {
  const [state, send] = useMachine(createGardenMachine);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { selectedChainId } = useAdminStore();

  const startCreation = (params: CreateGardenParams) => {
    send({ type: "START", params });
  };

  const submitCreation = async () => {
    if (!walletClient || !address || !state.context.gardenParams) {
      send({ type: "FAILURE", error: "Wallet not connected or invalid parameters" });
      return;
    }

    send({ type: "SUBMIT" });

    try {
      const contracts = getNetworkContracts(selectedChainId);
      const params = state.context.gardenParams;

      const hash = await walletClient.writeContract({
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

      send({ type: "SUCCESS", txHash: hash });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      send({ type: "FAILURE", error: message });
    }
  };

  const retry = () => {
    send({ type: "RETRY" });
    submitCreation();
  };

  const reset = () => {
    send({ type: "RESET" });
  };

  return {
    state,
    startCreation,
    submitCreation,
    retry,
    reset,
    canRetry: state.matches("error") && state.context.retryCount < 3,
  };
}
