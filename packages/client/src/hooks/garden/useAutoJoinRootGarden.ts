import { useEffect, useState } from "react";
import { useUser } from "../auth/useUser";
import { getNetworkConfig } from "@/config/blockchain";
import { useWriteContract, useReadContract } from "wagmi";
import { encodeFunctionData } from "viem";
import GardenAccountABI from "@/utils/blockchain/abis/GardenAccount.json";

interface JoinState {
  isGardener: boolean;
  isLoading: boolean;
  hasPrompted: boolean;
  showPrompt: boolean;
}

export function useAutoJoinRootGarden() {
  const { smartAccountAddress, smartAccountClient, ready } = useUser();
  const networkConfig = getNetworkConfig();
  const rootGarden = networkConfig.rootGarden;

  const [state, setState] = useState<JoinState>({
    isGardener: false,
    isLoading: true,
    hasPrompted: false,
    showPrompt: false,
  });

  // Check if user is already a gardener
  const { data: isGardener, isLoading: checkingMembership } = useReadContract({
    address: rootGarden?.address,
    abi: GardenAccountABI,
    functionName: "gardeners",
    args: [smartAccountAddress],
    query: {
      enabled: !!smartAccountAddress && !!rootGarden,
      refetchInterval: false,
    },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  // Check if we should show the join prompt
  useEffect(() => {
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (checkingMembership) return;

    const hasPromptedBefore = localStorage.getItem("rootGardenPrompted") === "true";

    if (!isGardener && !hasPromptedBefore) {
      setState((prev) => ({ ...prev, showPrompt: true, isLoading: false }));
    } else {
      setState((prev) => ({
        ...prev,
        isGardener: Boolean(isGardener),
        isLoading: false,
      }));
    }
  }, [ready, smartAccountAddress, rootGarden, isGardener, checkingMembership]);

  const joinGarden = async () => {
    if (!rootGarden || !smartAccountAddress) return;

    try {
      console.log("Joining root garden:", rootGarden.address);

      if (smartAccountClient?.account) {
        // Use smart account for passkey authentication
        await smartAccountClient.sendTransaction({
          to: rootGarden.address,
          value: 0n,
          data: encodeFunctionData({
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          }),
        });

        console.log("Successfully joined root garden with passkey");
      } else {
        // Use wagmi for wallet authentication
        await writeContractAsync({
          address: rootGarden.address,
          abi: GardenAccountABI,
          functionName: "joinGarden",
          args: [],
        });

        console.log("Successfully joined root garden with wallet");
      }

      localStorage.setItem("rootGardenPrompted", "true");
      setState((prev) => ({
        ...prev,
        isGardener: true,
        showPrompt: false,
        hasPrompted: true,
      }));

      console.log("Successfully joined root garden");
    } catch (error) {
      console.error("Failed to join root garden:", error);
      throw error;
    }
  };

  const dismissPrompt = () => {
    localStorage.setItem("rootGardenPrompted", "true");
    setState((prev) => ({ ...prev, showPrompt: false, hasPrompted: true }));
  };

  return {
    ...state,
    isPending,
    joinGarden,
    dismissPrompt,
  };
}
