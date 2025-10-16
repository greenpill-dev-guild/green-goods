/**
 * Auto-Join Root Garden Hook
 *
 * Manages joining the root community garden on first login.
 * Supports automatic joining for passkey users and manual prompt for wallet users.
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

const ONBOARDED_STORAGE_KEY = "greengoods_user_onboarded";
const ROOT_GARDEN_PROMPTED_KEY = "rootGardenPrompted";

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
 * - Auto-joins on first login for passkey users (when autoJoin=true)
 * - Shows manual prompt for wallet users (when autoJoin=false)
 * - Uses direct joinGarden() function (no invite codes)
 * - Stores join status in localStorage to prevent duplicate prompts
 *
 * Storage Keys:
 * - greengoods_user_onboarded: Set to "true" after successful first-time onboarding
 * - rootGardenPrompted: Set to "true" when wallet user has been prompted or dismissed
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
  // Note: This is primarily called manually from Login component for controlled flow
  useEffect(() => {
    if (!autoJoin) return;
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (checkingMembership || isGardener) return;

    const isOnboarded = localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
    if (isOnboarded) {
      logger.log("User already onboarded, skipping auto-join");
      return;
    }

    // This auto-join is mainly a fallback - primary flow is in Login component
    logger.log("Auto-joining root garden (fallback)");
    joinGarden().catch((err) => {
      logger.error("Auto-join failed", err);
    });
  }, [autoJoin, ready, smartAccountAddress, rootGarden, isGardener, checkingMembership]);

  // Manual prompt effect (when autoJoin=false, shows prompt for wallet users to join)
  useEffect(() => {
    if (autoJoin) return; // Skip if auto-join is enabled
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (checkingMembership) return;

    const hasPromptedBefore = localStorage.getItem(ROOT_GARDEN_PROMPTED_KEY) === "true";

    if (!isGardener && !hasPromptedBefore) {
      setState((prev) => ({ ...prev, showPrompt: true, isLoading: false }));
    }
  }, [autoJoin, ready, smartAccountAddress, rootGarden, isGardener, checkingMembership]);

  /**
   * Join the root garden using direct joinGarden() function (no invite codes).
   *
   * Supports both passkey (smart account) and wallet (wagmi) authentication.
   * For passkey users: Transaction is sponsored via Pimlico paymaster.
   * For wallet users: User pays gas fees directly.
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
        // Use smart account for passkey authentication (sponsored transaction)
        await (smartAccountClient.sendTransaction as any)({
          to: rootGarden.address,
          value: 0n,
          data: encodeFunctionData({
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          }),
        });

        logger.log("Successfully joined root garden with passkey (sponsored)");
      } else {
        // Use wagmi for wallet authentication (user pays gas)
        await writeContractAsync({
          address: rootGarden.address,
          abi: GardenAccountABI,
          functionName: "joinGarden",
          args: [],
        });

        logger.log("Successfully joined root garden with wallet");
      }

      // Set appropriate localStorage flags
      localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");

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
   * Used for wallet users who can manually join later.
   */
  const dismissPrompt = () => {
    logger.log("Dismissing root garden prompt");
    localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
    setState((prev) => ({ ...prev, showPrompt: false, hasPrompted: true }));
  };

  return {
    ...state,
    isPending,
    joinGarden,
    dismissPrompt,
  };
}
