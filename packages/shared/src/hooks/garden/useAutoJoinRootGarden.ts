/**
 * Auto-Join Root Garden Hook
 *
 * Manages joining the root community garden on first login.
 * Also handles joining the DevConnect garden (Token ID 1) if enabled via VITE_DEVCONNECT.
 *
 * @module hooks/garden/useAutoJoinRootGarden
 */

import { useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
import { ONBOARDED_STORAGE_KEY } from "../../config/app";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID, getDefaultChain } from "../../config/blockchain";
import type { PasskeySession } from "../../modules/auth/passkey";
import { simulateJoinGarden } from "../../utils/contract/simulation";
import { GardenAccountABI } from "../../utils/contracts";
import { isAlreadyGardenerError } from "../../utils/errors";
import { useUser } from "../auth/useUser";
import { useGardens } from "../blockchain/useBaseLists";
import { queryInvalidation, queryKeys } from "../query-keys";

const VITE_DEVCONNECT = import.meta.env.VITE_DEVCONNECT === "true";
const ROOT_GARDEN_PROMPTED_KEY = "rootGardenPrompted";
const DEVCONNECT_TOKEN_ID = 1;

const getOnboardedKey = (address?: string | null) => {
  if (!address) {
    return ONBOARDED_STORAGE_KEY;
  }
  return `${ONBOARDED_STORAGE_KEY}:${address.toLowerCase()}`;
};

const getDevConnectOnboardedKey = (address: string) =>
  `greengoods_devconnect_onboarded:${address.toLowerCase()}`;

/**
 * Standalone check for membership (used in Login flow before hook initialization)
 */
export async function checkMembership(address: string): Promise<{
  isGardener: boolean;
  hasBeenOnboarded: boolean;
}> {
  const onboardingKey = getOnboardedKey(address);
  const hasBeenOnboarded = localStorage.getItem(onboardingKey) === "true";
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
    console.warn("Failed to check on-chain membership, using localStorage fallback:", error);
    return {
      isGardener: hasBeenOnboarded, // Conservative: assume localStorage is correct
      hasBeenOnboarded,
    };
  }
}

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
 * - Supports DevConnect garden joining (Token ID 1)
 *
 * Storage Keys:
 * - greengoods_user_onboarded: Set to "true" after successful first-time onboarding
 * - rootGardenPrompted: Set to "true" when wallet user has been prompted or dismissed
 * - greengoods_devconnect_onboarded: Set to "true" after joining DevConnect garden
 *
 * @param autoJoin - If true, automatically joins without user prompt (passkey flow)
 * @returns Join state and functions for manual join/dismiss
 */
export function useAutoJoinRootGarden(autoJoin = false) {
  const { smartAccountAddress, smartAccountClient, ready, eoa } = useUser();
  // Support both passkey (smartAccountAddress) and wallet (eoa.address) users
  const walletAddress = eoa?.address;
  const primaryAddress = smartAccountAddress || walletAddress;

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
    if (!gardens) return null;

    // Always use token ID 0 (the first garden)
    return gardens.find((garden) => Number(garden.tokenID) === 0) ?? null;
  }, [gardens]);

  // --- DEVCONNECT LOGIC ---
  const devConnectGardenRecord = useMemo(() => {
    if (!VITE_DEVCONNECT || !gardens) return null;
    return gardens.find((garden) => Number(garden.tokenID) === DEVCONNECT_TOKEN_ID) ?? null;
  }, [gardens]);

  const { writeContractAsync, isPending } = useWriteContract();

  // Check membership from indexer data (Token ID 0)
  // User is a member if they're in either gardeners OR operators array
  const derivedIsMember = useMemo(() => {
    if (!rootGardenRecord || !primaryAddress) return false;

    const normalized = normalizeAddress(primaryAddress);

    // Check if user is a gardener (coalesce to boolean)
    const isGardener =
      rootGardenRecord.gardeners?.some((m) => normalizeAddress(m) === normalized) ?? false;

    // Check if user is an operator (coalesce to boolean)
    const isOperator =
      rootGardenRecord.operators?.some((m) => normalizeAddress(m) === normalized) ?? false;

    return isGardener || isOperator;
  }, [rootGardenRecord, primaryAddress, normalizeAddress]);

  // DevConnect membership check (Token ID 1)
  const derivedIsDevConnectMember = useMemo(() => {
    if (!VITE_DEVCONNECT || !devConnectGardenRecord || !primaryAddress) return false;

    const normalized = normalizeAddress(primaryAddress);

    // Coalesce to boolean to avoid undefined
    const isGardener =
      devConnectGardenRecord.gardeners?.some((m) => normalizeAddress(m) === normalized) ?? false;

    const isOperator =
      devConnectGardenRecord.operators?.some((m) => normalizeAddress(m) === normalized) ?? false;

    return isGardener || isOperator;
  }, [devConnectGardenRecord, primaryAddress, normalizeAddress]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isGardener: derivedIsMember,
      isLoading: gardensLoading || gardensFetching || isPending,
    }));
  }, [derivedIsMember, gardensLoading, gardensFetching, isPending]);

  // Generic Join Function
  const executeJoin = useCallback(
    async (gardenAddress: string, sessionOverride?: PasskeySession) => {
      // For session override (auto-join on login), use session address/client
      // Otherwise, use primaryAddress and smartAccountClient (if available)
      const targetAddress = sessionOverride?.address ?? primaryAddress;
      const client = sessionOverride?.client ?? smartAccountClient;

      if (!gardenAddress || !targetAddress) throw new Error("Missing join data");

      let txHash: string;
      if (client?.account) {
        // Use smart account for passkey authentication (sponsored transaction)
        // Skip simulation for sponsored transactions - let them fail with paymaster error if needed
        txHash = await client.sendTransaction({
          account: client.account,
          chain: client.chain,
          to: gardenAddress as `0x${string}`,
          value: 0n,
          data: encodeFunctionData({ abi: GardenAccountABI, functionName: "joinGarden", args: [] }),
        });
      } else {
        // Use wagmi for wallet authentication (user pays gas)
        // Simulate first to catch errors before user pays gas
        const simulation = await simulateJoinGarden(
          gardenAddress as `0x${string}`,
          targetAddress as `0x${string}`
        );

        // If simulation failed, throw error BEFORE transaction to avoid wasting gas
        if (!simulation.success) {
          if (simulation.error) {
            // Use parsed error message if available
            const error = new Error(simulation.error.message);
            error.name = simulation.error.name;
            throw error;
          }
          // Fallback if error object is missing
          throw new Error("Transaction simulation failed. Please try again.");
        }

        txHash = await writeContractAsync({
          address: gardenAddress as `0x${string}`,
          abi: GardenAccountABI,
          functionName: "joinGarden",
          args: [],
        });
      }

      // Invalidate all garden-related queries using centralized pattern
      const keysToInvalidate = queryInvalidation.invalidateGardens(chainId);
      await Promise.all(
        keysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))
      );
      await refetchGardens();
      return txHash;
    },
    [primaryAddress, smartAccountClient, writeContractAsync, chainId, queryClient, refetchGardens]
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
      const targetAddress = sessionOverride?.address ?? primaryAddress;

      // Use token ID 0 garden from indexer instead of deployment config
      if (!rootGardenRecord?.id) {
        throw new Error("Root garden (Token ID 0) not found. Please try again later.");
      }

      try {
        await executeJoin(rootGardenRecord.id, sessionOverride);

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
        if (targetAddress) {
          queryClient.setQueryData(
            queryKeys.gardens.byChain(chainId),
            (oldGardens: any[] | undefined) => {
              if (!oldGardens) return oldGardens;
              return oldGardens.map((garden) => {
                // Check if this is the root garden (Token ID 0)
                const isRoot = Number(garden.tokenID) === 0;

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
        }

        // Refetch gardens to get updated membership list
        await refetchGardens();
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
      executeJoin,
      normalizeAddress,
      queryClient,
      refetchGardens,
      rootGardenRecord,
      primaryAddress,
    ]
  );

  // Join DevConnect
  const joinDevConnect = useCallback(
    async (sessionOverride?: PasskeySession) => {
      if (!VITE_DEVCONNECT) return;
      // Try to get address from record, fallback to fetch not needed as useGardens covers it
      const address = devConnectGardenRecord?.id;
      if (!address) throw new Error("DevConnect garden not found (Token ID 1)");

      const targetAddress = sessionOverride?.address ?? primaryAddress;

      try {
        await executeJoin(address, sessionOverride);
        const key = getDevConnectOnboardedKey(targetAddress ?? "");
        localStorage.setItem(key, "true");
        await refetchGardens();
      } catch (error) {
        if (isAlreadyGardenerError(error)) {
          const key = getDevConnectOnboardedKey(targetAddress ?? "");
          localStorage.setItem(key, "true");
          await refetchGardens();
          return;
        }
        throw error;
      }
    },
    [devConnectGardenRecord, executeJoin, primaryAddress, refetchGardens]
  );

  // Auto-join effect (when autoJoin=true, joins automatically on first login)
  // Note: This is primarily called manually from Login component for controlled flow
  useEffect(() => {
    if (!autoJoin) return;
    if (!ready || !primaryAddress || !rootGardenRecord) return;
    if (gardensLoading || gardensFetching || derivedIsMember) return;

    const onboardedKey = getOnboardedKey(primaryAddress);
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
    primaryAddress,
    rootGardenRecord,
    derivedIsMember,
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
    isGardener: derivedIsMember || state.isGardener,
    // DevConnect specific
    devConnect: {
      isEnabled: VITE_DEVCONNECT,
      isMember: derivedIsDevConnectMember,
      isLoading: gardensLoading || gardensFetching,
      join: joinDevConnect,
      gardenAddress: devConnectGardenRecord?.id,
    },
  };
}
