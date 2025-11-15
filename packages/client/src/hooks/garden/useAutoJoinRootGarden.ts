/**
 * Auto-Join Root Garden Hook
 *
 * Manages joining the root community garden on first login.
 * Uses onchain contract read as source of truth for membership.
 *
 * @module hooks/garden/useAutoJoinRootGarden
 */

import { DEFAULT_CHAIN_ID, getDefaultChain, wagmiConfig } from "@green-goods/shared/config";
import { queryInvalidation, useUser } from "@green-goods/shared/hooks";
import type { PasskeySession } from "@green-goods/shared/modules";
import { GardenAccountABI, isAlreadyGardenerError } from "@green-goods/shared/utils";
import { useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useMemo } from "react";
import { encodeFunctionData } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

// Single storage key for tracking if user has been onboarded (per-address)
const getOnboardedKey = (address: string) => `greengoods_onboarded:${address.toLowerCase()}`;

/**
 * Checks if a user is already a gardener in the root garden.
 * Uses wagmi's readContract to share the same config and RPC transports.
 *
 * @param address - The user's address to check
 * @returns Object with isGardener (on-chain status) and hasBeenOnboarded (localStorage flag)
 */
export async function checkMembership(address: string): Promise<{
  isGardener: boolean;
  hasBeenOnboarded: boolean;
}> {
  const onboardingKey = getOnboardedKey(address);
  const hasBeenOnboarded = localStorage.getItem(onboardingKey) === "true";

  // Get network config and root garden address
  const networkConfig = getDefaultChain();
  const rootGarden = networkConfig.rootGarden;

  if (!rootGarden?.address) {
    // No root garden configured, can't check membership
    return {
      isGardener: false,
      hasBeenOnboarded,
    };
  }

  try {
    // Use wagmi's readContract - shares the same config as useReadContract hook
    const isGardener = await readContract(wagmiConfig, {
      address: rootGarden.address,
      abi: GardenAccountABI,
      functionName: "gardeners",
      args: [address as `0x${string}`],
    });

    // Update localStorage if on-chain status shows they're a gardener
    if (isGardener && !hasBeenOnboarded) {
      localStorage.setItem(onboardingKey, "true");
    }

    return {
      isGardener: Boolean(isGardener),
      hasBeenOnboarded: Boolean(isGardener) || hasBeenOnboarded,
    };
  } catch (error) {
    // Offline or RPC error: fall back to localStorage
    // This allows the app to work offline while still being conservative
    console.warn("Failed to check on-chain membership, using localStorage fallback:", error);
    return {
      isGardener: hasBeenOnboarded, // Conservative: assume localStorage is correct
      hasBeenOnboarded,
    };
  }
}

/**
 * Hook for managing root garden membership.
 *
 * Features:
 * - Checks membership via onchain contract read (source of truth)
 * - Provides joinGarden function for both passkey (sponsored) and wallet (user pays) flows
 * - Stores onboarded flag in localStorage per address
 *
 * @returns Membership status, loading state, and join function
 */
export function useAutoJoinRootGarden() {
  const { smartAccountAddress, smartAccountClient, ready } = useUser();
  const networkConfig = getDefaultChain();
  const rootGarden = networkConfig.rootGarden;
  const chainId = Number(networkConfig.chainId ?? DEFAULT_CHAIN_ID);
  const queryClient = useQueryClient();

  // Single source of truth: onchain contract read
  const {
    data: isGardener = false,
    isLoading,
    refetch: refetchMembership,
  } = useReadContract({
    address: rootGarden?.address,
    abi: GardenAccountABI,
    functionName: "gardeners",
    args: smartAccountAddress ? [smartAccountAddress] : undefined,
    query: {
      enabled: !!rootGarden?.address && !!smartAccountAddress && ready,
      staleTime: 5000, // 5 seconds - refetch frequently for membership changes
    },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  // Check if user has been onboarded (ever joined root garden)
  const hasBeenOnboarded = useMemo(() => {
    if (!smartAccountAddress) return false;
    return localStorage.getItem(getOnboardedKey(smartAccountAddress)) === "true";
  }, [smartAccountAddress]);

  /**
   * Join the root garden.
   *
   * For passkey users: Transaction is sponsored via Pimlico paymaster
   * For wallet users: User pays gas fees directly
   *
   * @param sessionOverride - Optional passkey session for onboarding flow
   * @throws {Error} If join transaction fails (unless AlreadyGardener)
   */
  const joinGarden = useCallback(
    async (sessionOverride?: PasskeySession) => {
      const targetAddress = sessionOverride?.address ?? smartAccountAddress;
      const client = sessionOverride?.client ?? smartAccountClient;

      if (!rootGarden?.address || !targetAddress) {
        throw new Error("Missing root garden address or user address");
      }

      try {
        let txHash: string;

        if (client?.account) {
          // Passkey flow: sponsored transaction
          txHash = await client.sendTransaction({
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
          // Wallet flow: user pays gas
          txHash = await writeContractAsync({
            address: rootGarden.address,
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          });
        }

        // Mark as onboarded
        localStorage.setItem(getOnboardedKey(targetAddress), "true");

        // Invalidate garden queries
        const keysToInvalidate = queryInvalidation.invalidateGardens(chainId);
        await Promise.all(
          keysToInvalidate.map((key: readonly unknown[]) =>
            queryClient.invalidateQueries({ queryKey: key })
          )
        );

        // Refetch membership status
        await refetchMembership();

        return txHash;
      } catch (error) {
        // AlreadyGardener is not actually an error - user is already a member
        if (isAlreadyGardenerError(error)) {
          localStorage.setItem(getOnboardedKey(targetAddress), "true");
          await refetchMembership();
          return null; // Successfully handled, no tx hash
        }
        throw error;
      }
    },
    [
      chainId,
      queryClient,
      refetchMembership,
      rootGarden?.address,
      smartAccountAddress,
      smartAccountClient,
      writeContractAsync,
    ]
  );

  return {
    isGardener,
    isLoading: isLoading || isPending,
    hasBeenOnboarded,
    joinGarden,
    refetchMembership,
  };
}
