/**
 * Auto-Join Root Garden Hook
 *
 * Manages joining the root community garden on first login.
 * Supports automatic joining for passkey users and manual prompt for wallet users.
 *
 * @module hooks/garden/useAutoJoinRootGarden
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useUser } from "../auth/useUser";
import { DEFAULT_CHAIN_ID, getNetworkConfig } from "../../config/blockchain";
import { useWriteContract } from "wagmi";
import { encodeFunctionData } from "viem";
import { GardenAccountABI } from "../../utils/contracts";
import type { PasskeySession } from "../../modules/auth/passkey";
import { ONBOARDED_STORAGE_KEY } from "../../config/app";
import { useGardens } from "../blockchain/useBaseLists";
import { useQueryClient } from "@tanstack/react-query";

const ROOT_GARDEN_PROMPTED_KEY = "rootGardenPrompted";

const getOnboardedKey = (address?: string | null) => {
  if (!address) {
    return ONBOARDED_STORAGE_KEY;
  }
  return `${ONBOARDED_STORAGE_KEY}:${address.toLowerCase()}`;
};

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
  const chainId = Number(networkConfig.chainId ?? DEFAULT_CHAIN_ID);
  const {
    data: gardens,
    isLoading: gardensLoading,
    isFetching: gardensFetching,
    refetch: refetchGardens,
  } = useGardens(chainId);
  const queryClient = useQueryClient();

  const normalizeAddress = useCallback((value?: string | null) => value?.toLowerCase() ?? "", []);
  const rootGardenAddressNormalized = useMemo(
    () => normalizeAddress(rootGarden?.address),
    [rootGarden?.address, normalizeAddress]
  );
  const rootGardenTokenId = useMemo(
    () => (typeof rootGarden?.tokenId !== "undefined" ? Number(rootGarden.tokenId) : undefined),
    [rootGarden?.tokenId]
  );

  const [state, setState] = useState<JoinState>({
    isGardener: false,
    isLoading: true,
    hasPrompted: false,
    showPrompt: false,
  });

  const rootGardenRecord = useMemo(() => {
    if (!gardens || !rootGardenAddressNormalized) return null;

    return (
      gardens.find((garden) => {
        const matchesAddress =
          normalizeAddress(garden.tokenAddress) === rootGardenAddressNormalized;
        const matchesToken =
          typeof rootGardenTokenId === "number"
            ? Number(garden.tokenID) === rootGardenTokenId
            : true;
        return matchesAddress && matchesToken;
      }) ?? null
    );
  }, [gardens, normalizeAddress, rootGardenAddressNormalized, rootGardenTokenId]);

  const { writeContractAsync, isPending } = useWriteContract();
  const derivedIsGardener = useMemo(() => {
    const targetAddress = normalizeAddress(smartAccountAddress);
    if (!targetAddress) return false;
    const members = rootGardenRecord?.gardeners ?? [];
    return members.some((member) => normalizeAddress(member) === targetAddress);
  }, [rootGardenRecord?.gardeners, smartAccountAddress, normalizeAddress]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isGardener: derivedIsGardener,
      isLoading: gardensLoading || gardensFetching || isPending,
    }));
  }, [derivedIsGardener, gardensLoading, gardensFetching, isPending]);

  const checkMembership = useCallback(
    async (addressOverride?: string | null) => {
      const targetAddress = normalizeAddress(addressOverride ?? smartAccountAddress);
      if (!targetAddress) return false;

      try {
        const result = await refetchGardens();
        const updatedGardens = result.data ?? gardens ?? [];

        const match = updatedGardens.find((garden) => {
          if (!rootGardenAddressNormalized) return false;
          const matchesAddress =
            normalizeAddress(garden.tokenAddress) === rootGardenAddressNormalized;
          const matchesToken =
            typeof rootGardenTokenId === "number"
              ? Number(garden.tokenID) === rootGardenTokenId
              : true;
          return matchesAddress && matchesToken;
        });

        const isMember =
          match?.gardeners?.some((member) => normalizeAddress(member) === targetAddress) ?? false;

        if (isMember) {
          const onboardKey = getOnboardedKey(targetAddress);
          localStorage.setItem(onboardKey, "true");
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          setState((prev) => ({ ...prev, isGardener: true }));
        }

        return isMember;
      } catch (err) {
        console.error("Failed to check root garden membership", err);
        return false;
      }
    },
    [
      refetchGardens,
      gardens,
      normalizeAddress,
      rootGardenAddressNormalized,
      rootGardenTokenId,
      smartAccountAddress,
    ],
  );

  /**
   * Join the root garden using direct joinGarden() function (no invite codes).
   *
   * Supports both passkey (smart account) and wallet (wagmi) authentication.
   * For passkey users: Transaction is sponsored via Pimlico paymaster.
   * For wallet users: User pays gas fees directly.
   *
   * @throws {Error} If join transaction fails
   */
  const joinGarden = useCallback(
    async (sessionOverride?: PasskeySession) => {
      const targetAddress = sessionOverride?.address ?? smartAccountAddress;
      const clientOverride = sessionOverride?.client;

      if (!rootGarden || !targetAddress) {
        console.warn("Cannot join: missing root garden or address");
        return;
      }

      try {
        console.log("Joining root garden", {
          address: rootGarden.address,
          mode: clientOverride || smartAccountClient ? "passkey" : "wallet",
        });

        const client = clientOverride ?? smartAccountClient;

        if (client?.account) {
          // Use smart account for passkey authentication (sponsored transaction)
          await client.sendTransaction({
            account: client.account,
            chain: client.chain,
            to: rootGarden.address,
            value: 0n,
            data: encodeFunctionData({
              abi: GardenAccountABI,
              functionName: "joinGarden",
              args: [],
            }),
          });

          console.log("Successfully joined root garden with passkey (sponsored)");
        } else {
          // Use wagmi for wallet authentication (user pays gas)
          await writeContractAsync({
            address: rootGarden.address,
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          });

          console.log("Successfully joined root garden with wallet");
        }

        // Set appropriate localStorage flags
        localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
        const onboardKey = getOnboardedKey(targetAddress);
        localStorage.setItem(onboardKey, "true");
        localStorage.setItem(ONBOARDED_STORAGE_KEY, "true"); // legacy key for backward compatibility

        setState((prev) => ({
          ...prev,
          isGardener: true,
          showPrompt: false,
          hasPrompted: true,
          isLoading: false,
        }));

        console.log("Root garden join complete");
        await queryClient.invalidateQueries({
          queryKey: ["gardens", chainId],
        });
        await checkMembership(targetAddress);
      } catch (error) {
        console.error("Failed to join root garden", error);
        throw error;
      }
    },
    [
      chainId,
      checkMembership,
      queryClient,
      rootGarden,
      smartAccountAddress,
      smartAccountClient,
      writeContractAsync,
    ],
  );

  // Auto-join effect (when autoJoin=true, joins automatically on first login)
  // Note: This is primarily called manually from Login component for controlled flow
  useEffect(() => {
    if (!autoJoin) return;
    if (!ready || !smartAccountAddress || !rootGarden) return;
    if (gardensLoading || gardensFetching || derivedIsGardener) return;

    const onboardedKey = getOnboardedKey(smartAccountAddress);
    const isOnboarded =
      localStorage.getItem(onboardedKey) === "true" ||
      localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
    if (isOnboarded) {
      console.log("User already onboarded, skipping auto-join");
      return;
    }

    // This auto-join is mainly a fallback - primary flow is in Login component
    console.log("Auto-joining root garden (fallback)");
    joinGarden().catch((err) => {
      console.error("Auto-join failed", err);
    });
  }, [
    autoJoin,
    ready,
    smartAccountAddress,
    rootGarden,
    derivedIsGardener,
    gardensLoading,
    gardensFetching,
    joinGarden,
  ]);

  /**
   * Dismiss the join prompt without joining.
   * Sets localStorage flag to prevent showing prompt again.
   * Used for wallet users who can manually join later.
   */
  const dismissPrompt = () => {
    console.log("Dismissing root garden prompt");
    localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
    setState((prev) => ({ ...prev, showPrompt: false, hasPrompted: true }));
  };

  return {
    ...state,
    isPending,
    joinGarden,
    dismissPrompt,
    isGardener: derivedIsGardener || state.isGardener,
    checkMembership,
  };
}
