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
import { DEFAULT_CHAIN_ID, getDefaultChain } from "../../config/blockchain";
import { useWriteContract, useReadContract } from "wagmi";
import { encodeFunctionData } from "viem";
import { GardenAccountABI } from "../../utils/contracts";
import type { PasskeySession } from "../../modules/auth/passkey";
import { ONBOARDED_STORAGE_KEY } from "../../config/app";
import { useGardens } from "../blockchain/useBaseLists";
import { useQueryClient } from "@tanstack/react-query";
import { isAlreadyGardenerError } from "../../utils/errors";
import { queryInvalidation, queryKeys } from "../query-keys";

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
  const networkConfig = getDefaultChain();
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

  // Onchain check: directly read from the gardeners mapping on the contract
  const {
    data: isGardenerOnchain,
    isLoading: isCheckingOnchain,
    refetch: refetchOnchainStatus,
  } = useReadContract({
    address: rootGarden?.address,
    abi: GardenAccountABI,
    functionName: "gardeners",
    args: smartAccountAddress ? [smartAccountAddress] : undefined,
    query: {
      enabled: !!rootGarden?.address && !!smartAccountAddress,
      staleTime: 10000, // 10 seconds - refetch more frequently for membership changes
    },
  });

  // Fallback to indexer data for initial load, but prefer onchain data
  const derivedIsGardenerFromIndexer = useMemo(() => {
    const targetAddress = normalizeAddress(smartAccountAddress);
    if (!targetAddress) return false;
    const members = rootGardenRecord?.gardeners ?? [];
    return members.some((member) => normalizeAddress(member) === targetAddress);
  }, [rootGardenRecord?.gardeners, smartAccountAddress, normalizeAddress]);

  const hasIndexerRecord = rootGardenRecord !== null;
  const derivedIsGardener: boolean =
    (typeof isGardenerOnchain === "boolean" && isGardenerOnchain) ||
    (hasIndexerRecord ? derivedIsGardenerFromIndexer : false);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isGardener: derivedIsGardener,
      isLoading: gardensLoading || gardensFetching || isPending || isCheckingOnchain,
    }));
  }, [derivedIsGardener, gardensLoading, gardensFetching, isPending, isCheckingOnchain]);

  const checkMembership = useCallback(
    async (addressOverride?: string | null) => {
      const targetAddress = normalizeAddress(addressOverride ?? smartAccountAddress);

      if (!targetAddress) {
        return false;
      }

      try {
        // Refetch onchain status first (source of truth)
        const onchainResult = await refetchOnchainStatus();
        const isOnchainMember = onchainResult.data ?? false;

        // Also refetch indexer data for consistency
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

        const isMemberFromIndexer =
          match?.gardeners?.some((member) => normalizeAddress(member) === targetAddress) ?? false;

        const hasIndexerMatch = !!match;
        // Prefer indexer result when available; fall back to onchain when indexer has no record yet
        const isMember = hasIndexerMatch ? isMemberFromIndexer : isOnchainMember;

        if (isMember) {
          const onboardKey = getOnboardedKey(targetAddress);
          localStorage.setItem(onboardKey, "true");
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          setState((prev) => ({ ...prev, isGardener: true }));
        }

        return isMember;
      } catch (err) {
        console.error("[checkMembership] Failed to check root garden membership", err);
        return false;
      }
    },
    [
      refetchOnchainStatus,
      refetchGardens,
      gardens,
      normalizeAddress,
      rootGardenAddressNormalized,
      rootGardenTokenId,
      smartAccountAddress,
    ]
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
        throw new Error("Missing required data for joining garden");
      }

      try {
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
        } else {
          // Use wagmi for wallet authentication (user pays gas)
          await writeContractAsync({
            address: rootGarden.address,
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          });
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

        // Optimistic update: update the cache immediately so UI reflects membership
        // This ensures WorkProvider sees the user as a member without waiting for indexer
        queryClient.setQueryData(
          queryKeys.gardens.byChain(chainId),
          (oldGardens: any[] | undefined) => {
            if (!oldGardens) return oldGardens;
            return oldGardens.map((garden) => {
              // Check if this is the root garden
              const isRoot =
                normalizeAddress(garden.tokenAddress) === rootGardenAddressNormalized &&
                (typeof rootGardenTokenId === "number"
                  ? Number(garden.tokenID) === rootGardenTokenId
                  : true);

              if (isRoot) {
                // Add user to gardeners list if not already there
                const currentGardeners = garden.gardeners || [];
                const isAlreadyInList = currentGardeners.some(
                  (g: string) => normalizeAddress(g) === normalizeAddress(targetAddress)
                );
                if (!isAlreadyInList) {
                  return {
                    ...garden,
                    gardeners: [...currentGardeners, targetAddress],
                  };
                }
              }
              return garden;
            });
          }
        );

        // Invalidate all garden-related queries using centralized pattern
        const keysToInvalidate = queryInvalidation.invalidateGardens(chainId);
        await Promise.all(
          keysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))
        );

        // Refetch gardens to ensure UI is updated
        await refetchGardens();

        // Check membership to ensure state is accurate
        await checkMembership(targetAddress);
      } catch (error) {
        // Special handling for AlreadyGardener error - not actually an error
        if (isAlreadyGardenerError(error)) {
          localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
          const onboardKey = getOnboardedKey(targetAddress);
          localStorage.setItem(onboardKey, "true");
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          setState((prev) => ({
            ...prev,
            isGardener: true,
            showPrompt: false,
            hasPrompted: true,
            isLoading: false,
          }));
          // Still refetch gardens even if already a gardener
          await refetchGardens();
          return; // Exit successfully
        }

        throw error;
      }
    },
    [
      chainId,
      checkMembership,
      queryClient,
      refetchGardens,
      rootGarden,
      smartAccountAddress,
      smartAccountClient,
      writeContractAsync,
      normalizeAddress,
      rootGardenAddressNormalized,
      rootGardenTokenId,
    ]
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
      return;
    }

    // This auto-join is mainly a fallback - primary flow is in Login component
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
