import { useMachine } from "@xstate/react";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { createGardenMachine } from "@/workflows/createGarden";
import { getNetworkContracts, GardenTokenABI, getChainById } from "@/utils/contracts";
import { useAdminStore } from "@/stores/admin";
import type { CreateGardenParams } from "@/types/contracts";

export function useCreateGardenWorkflow() {
  const [state, send] = useMachine(createGardenMachine);
  const { wallets } = useWallets();
  const wallet = wallets.find(w => w.walletClientType === "privy");
  const { selectedChainId } = useAdminStore();

  const startCreation = (params: CreateGardenParams) => {
    send({ type: "START", params });
  };

  const submitCreation = async () => {
    if (!wallet || !state.context.gardenParams) {
      send({ type: "FAILURE", error: "Wallet not connected or invalid parameters" });
      return;
    }

    const walletClient = createWalletClient({
      chain: getChainById(selectedChainId),
      transport: custom((wallet as unknown as { provider: any }).provider),
    });

    send({ type: "SUBMIT" });

    try {
      const contracts = getNetworkContracts(selectedChainId);
      const params = state.context.gardenParams;

      const hash = await walletClient.writeContract({
        address: contracts.gardenToken as `0x${string}`,
        abi: GardenTokenABI.abi,
        functionName: "mintGarden",
        account: wallet.address as `0x${string}`,
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