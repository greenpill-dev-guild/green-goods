/**
 * Auto-Join Root Garden Hook
 *
 * Simplified hook for managing root garden membership on first login.
 * Uses deployment config for root garden address (not indexer).
 *
 * @module hooks/garden/useAutoJoinRootGarden
 */

import { useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, type Hex } from "viem";
import { useWriteContract } from "wagmi";
import { ONBOARDED_STORAGE_KEY } from "../../config/app";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID, getDefaultChain } from "../../config/blockchain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { toastService } from "../../components/toast";
import { isAlreadyGardenerError } from "../../utils/errors/contract-errors";
import { useUser } from "../auth/useUser";
import { queryInvalidation } from "../query-keys";

/**
 * Session data for passkey authentication.
 * Used when calling joinGarden during login flow.
 */
interface PasskeySession {
  address: Hex;
  client: SmartAccountClient | null;
}

// Storage keys
const ROOT_GARDEN_PROMPTED_KEY = "greengoods_root_garden_prompted";

const getOnboardedKey = (address?: string | null) => {
  if (!address) return ONBOARDED_STORAGE_KEY;
  return `${ONBOARDED_STORAGE_KEY}:${address.toLowerCase()}`;
};

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
    return { isGardener: false, hasBeenOnboarded };
  }

  try {
    const isGardener = await readContract(wagmiConfig, {
      address: rootGarden.address,
      abi: GardenAccountABI,
      functionName: "gardeners",
      args: [address as `0x${string}`],
    });

    if (isGardener && !hasBeenOnboarded) {
      localStorage.setItem(onboardingKey, "true");
    }

    return {
      isGardener: Boolean(isGardener),
      hasBeenOnboarded: Boolean(isGardener) || hasBeenOnboarded,
    };
  } catch (error) {
    console.warn("Failed to check on-chain membership:", error);
    return { isGardener: hasBeenOnboarded, hasBeenOnboarded };
  }
}

/**
 * Hook for managing root garden membership.
 *
 * Simplified flow:
 * 1. On first login, prompts user once to join root garden via toast
 * 2. User can accept (join) or dismiss
 * 3. Shows success/error based on result
 * 4. Refetches garden data after joining
 *
 * @returns Join state and joinGarden function
 */
export function useAutoJoinRootGarden() {
  const { smartAccountAddress, smartAccountClient, eoa } = useUser();
  const primaryAddress = smartAccountAddress || eoa?.address;

  const networkConfig = getDefaultChain();
  const rootGarden = networkConfig.rootGarden;
  const chainId = Number(networkConfig.chainId ?? DEFAULT_CHAIN_ID);

  const [isLoading, setIsLoading] = useState(false);
  const hasPromptedRef = useRef(false);
  const promptToastIdRef = useRef<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();

  // Get QueryClient - always called unconditionally per React hook rules
  // The hook will throw if used outside QueryClientProvider, but that's expected
  const queryClient = useQueryClient();

  /**
   * Execute the join transaction
   */
  const executeJoin = useCallback(
    async (sessionOverride?: PasskeySession): Promise<string> => {
      const targetAddress = sessionOverride?.address ?? primaryAddress;
      const client = sessionOverride?.client ?? smartAccountClient;

      if (!rootGarden?.address || !targetAddress) {
        throw new Error("Missing join data");
      }

      let txHash: string;

      if (client?.account) {
        // Passkey user - sponsored transaction
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
        // Wallet user - pays gas
        txHash = await writeContractAsync({
          address: rootGarden.address,
          abi: GardenAccountABI,
          functionName: "joinGarden",
          args: [],
        });
      }

      return txHash;
    },
    [primaryAddress, smartAccountClient, rootGarden?.address, writeContractAsync]
  );

  /**
   * Refetch garden data after joining
   */
  const refetchGardenData = useCallback(async () => {
    const keysToInvalidate = queryInvalidation.invalidateGardens(chainId);
    await Promise.all(
      keysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    );
  }, [queryClient, chainId]);

  /**
   * Mark user as onboarded in localStorage
   */
  const markOnboarded = useCallback(
    (address?: string) => {
      const targetAddress = address ?? primaryAddress;
      localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
      if (targetAddress) {
        localStorage.setItem(getOnboardedKey(targetAddress), "true");
      }
      localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
    },
    [primaryAddress]
  );

  /**
   * Join the root garden.
   *
   * For passkey users: Transaction is sponsored via Pimlico paymaster.
   * For wallet users: User pays gas fees directly.
   */
  const joinGarden = useCallback(
    async (sessionOverride?: PasskeySession): Promise<void> => {
      const targetAddress = sessionOverride?.address ?? primaryAddress;

      if (!rootGarden?.address) {
        throw new Error("Root garden not configured for this network");
      }

      setIsLoading(true);

      try {
        await executeJoin(sessionOverride);
        markOnboarded(targetAddress);

        // Dismiss prompt toast if still showing
        if (promptToastIdRef.current) {
          toastService.dismiss(promptToastIdRef.current);
          promptToastIdRef.current = null;
        }

        toastService.success({
          title: "Welcome to Green Goods!",
          message: "You're now part of the community garden.",
          icon: "🌱",
          suppressLogging: true,
        });

        // Refetch garden data so user can start working immediately
        await refetchGardenData();
      } catch (error) {
        // Already a gardener is not an error
        if (isAlreadyGardenerError(error)) {
          markOnboarded(targetAddress);

          if (promptToastIdRef.current) {
            toastService.dismiss(promptToastIdRef.current);
            promptToastIdRef.current = null;
          }

          await refetchGardenData();
          return;
        }

        toastService.error({
          title: "Couldn't join garden",
          message: "Please try again from your profile.",
          error,
        });

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [primaryAddress, rootGarden?.address, executeJoin, markOnboarded, refetchGardenData]
  );

  /**
   * Dismiss the join prompt without joining.
   */
  const dismissPrompt = useCallback(() => {
    localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
    hasPromptedRef.current = true;

    if (promptToastIdRef.current) {
      toastService.dismiss(promptToastIdRef.current);
      promptToastIdRef.current = null;
    }

    toastService.info({
      title: "No problem!",
      message: "You can join the community garden anytime from your profile.",
      icon: "👋",
      duration: 3000,
      suppressLogging: true,
    });
  }, []);

  /**
   * Show the join prompt toast (call once after first login)
   */
  const promptToJoin = useCallback(() => {
    // Don't prompt if already prompted or no root garden
    if (hasPromptedRef.current) return;
    if (!rootGarden?.address) return;

    // Check if user has already been prompted
    const alreadyPrompted = localStorage.getItem(ROOT_GARDEN_PROMPTED_KEY) === "true";
    if (alreadyPrompted) {
      hasPromptedRef.current = true;
      return;
    }

    // Check if user is already onboarded
    if (primaryAddress) {
      const isOnboarded = localStorage.getItem(getOnboardedKey(primaryAddress)) === "true";
      if (isOnboarded) {
        hasPromptedRef.current = true;
        return;
      }
    }

    hasPromptedRef.current = true;

    // Show single toast with join action
    const toastId = toastService.info({
      title: "Join the Community Garden",
      message: "Get started by joining the root garden to track your impact.",
      icon: "🌱",
      duration: 15000, // Give user time to read and decide
      action: {
        label: "Join Now",
        onClick: () => {
          joinGarden().catch((err) => {
            console.error("Join garden failed:", err);
          });
        },
        dismissOnClick: true,
        testId: "join-garden-action",
      },
    });

    promptToastIdRef.current = toastId;

    // Auto-dismiss handler (if user doesn't interact)
    setTimeout(() => {
      if (promptToastIdRef.current === toastId) {
        // User didn't interact - mark as prompted but don't show dismiss message
        localStorage.setItem(ROOT_GARDEN_PROMPTED_KEY, "true");
        promptToastIdRef.current = null;
      }
    }, 15000);
  }, [rootGarden?.address, primaryAddress, joinGarden]);

  return {
    isLoading: isLoading || isPending,
    joinGarden,
    dismissPrompt,
    promptToJoin,
    rootGardenAddress: rootGarden?.address,
  };
}
