/**
 * Auto-Join Root Garden Hook
 *
 * Manages joining the root community garden on first login.
 * Supports both manual prompting and automatic joining for passkey users.
 *
 * @module hooks/garden/useAutoJoinRootGarden
 */

import { useEffect, useState } from "react";
import { useUser } from "../auth/useUser";
import { getNetworkConfig } from "@/config/blockchain";
import { useWriteContract, useReadContract } from "wagmi";
import { encodeFunctionData } from "viem";
import GardenAccountABI from "@/utils/blockchain/abis/GardenAccount.json";
import { createLogger } from "@/utils/app/logger";

const logger = createLogger("AutoJoinRootGarden");

/**
 * Join state for the root garden
 */
interface JoinState {
  isGardener: boolean;
  isLoading: boolean;
  hasPrompted: boolean;
  showPrompt: boolean;
}

/**
 * Hook for managing root garden membership.
 *
 * Features:
 * - Checks if user is already a member
 * - Shows prompt for manual join (when autoJoin=false)
 * - Auto-joins on first login (when autoJoin=true)
 * - Stores join status in localStorage to prevent duplicate prompts
 *
 * Storage Keys:
 * - rootGardenPrompted: Set to "true" when user has been prompted or dismissed
 * - rootGardenJoined: Set to "true" when user has successfully joined via auto-join
 *
 * @param autoJoin - If true, automatically joins without user prompt (passkey flow)
 * @returns Join state and functions for manual join/dismiss
 */
export function useAutoJoinRootGarden(autoJoin = false) {
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

  // Auto-join effect (when autoJoin=true, joins automatically on first login)
  useEffect(() => {
    if (!autoJoin) return;
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (checkingMembership || isGardener) return;

    const hasJoinedBefore = localStorage.getItem("rootGardenJoined") === "true";
    if (hasJoinedBefore) {
      logger.log("User already auto-joined previously, skipping");
      return;
    }

    // Trigger auto-join
    logger.log("Auto-joining root garden for new passkey user");
    joinGarden().catch((err) => {
      logger.error("Auto-join failed", err);
    });
  }, [autoJoin, ready, smartAccountAddress, rootGarden, isGardener, checkingMembership]);

  // Manual prompt effect (when autoJoin=false, shows prompt for user to join)
  useEffect(() => {
    if (autoJoin) return; // Skip if auto-join is enabled
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (checkingMembership) return;

    const hasPromptedBefore = localStorage.getItem("rootGardenPrompted") === "true";

    if (!isGardener && !hasPromptedBefore) {
      setState((prev) => ({ ...prev, showPrompt: true, isLoading: false }));
    }
    // Removed else block - no need to copy isGardener to state, already available from useReadContract
  }, [autoJoin, ready, smartAccountAddress, rootGarden, isGardener, checkingMembership]);

  /**
   * Join the root garden.
   *
   * Supports both passkey (smart account) and wallet (wagmi) authentication.
   * Sets appropriate localStorage flags based on join mode.
   *
   * @throws {Error} If join transaction fails
   */
  const joinGarden = async () => {
    if (!rootGarden || !smartAccountAddress) {
      logger.warn("Cannot join: missing root garden or address");
      return;
    }

    try {
      logger.log("Joining root garden", {
        address: rootGarden.address,
        mode: smartAccountClient ? "passkey" : "wallet",
      });

      if (smartAccountClient?.account) {
        // Use smart account for passkey authentication
        await (smartAccountClient.sendTransaction as any)({
          to: rootGarden.address,
          value: 0n,
          data: encodeFunctionData({
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          }),
        });

        logger.log("Successfully joined root garden with passkey");
      } else {
        // Use wagmi for wallet authentication
        await writeContractAsync({
          address: rootGarden.address,
          abi: GardenAccountABI,
          functionName: "joinGarden",
          args: [],
        });

        logger.log("Successfully joined root garden with wallet");
      }

      // Set appropriate localStorage flags
      if (autoJoin) {
        localStorage.setItem("rootGardenJoined", "true");
      }
      localStorage.setItem("rootGardenPrompted", "true");

      setState((prev) => ({
        ...prev,
        isGardener: true,
        showPrompt: false,
        hasPrompted: true,
      }));

      logger.log("Root garden join complete");
    } catch (error) {
      logger.error("Failed to join root garden", error);
      throw error;
    }
  };

  /**
   * Dismiss the join prompt without joining.
   * Sets localStorage flag to prevent showing prompt again.
   */
  const dismissPrompt = () => {
    logger.log("Dismissing root garden prompt");
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
