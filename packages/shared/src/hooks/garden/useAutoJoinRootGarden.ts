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
import { trackNetworkError } from "../../modules/app/error-tracking";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { toastService } from "../../components/toast";
import { isAlreadyGardenerError } from "../../utils/errors/contract-errors";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
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
    trackNetworkError(error, {
      source: "checkMembership",
      userAction: "checking root garden membership status",
      recoverable: true,
      metadata: {
        user_address: address,
        root_garden: rootGarden?.address,
        function_name: "gardeners",
        is_offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
      },
    });
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
  const { smartAccountClient } = useUser();
  // Use single source of truth for primary address
  const primaryAddress = usePrimaryAddress();

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
    (address?: string | null) => {
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
   *
   * @param sessionOverride - Optional passkey session for login flow
   * @param options.silent - If true, suppresses toast notifications (used by promptToJoin)
   */
  const joinGarden = useCallback(
    async (sessionOverride?: PasskeySession, options?: { silent?: boolean }): Promise<void> => {
      const targetAddress = sessionOverride?.address ?? primaryAddress;
      const silent = options?.silent ?? false;

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

        if (!silent) {
          toastService.success({
            title: "Welcome to Green Goods!",
            message: "You're now part of the community garden.",
            icon: "🌱",
            suppressLogging: true,
          });
        }

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

        if (!silent) {
          toastService.error({
            title: "Couldn't join garden",
            message: "Please try again from your profile.",
            error,
          });
        }

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
   * Auto-join root garden on first login.
   * Triggers passkey signing automatically, no button required.
   */
  const promptToJoin = useCallback(async () => {
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

    // Show loading toast while joining
    const loadingToastId = toastService.loading({
      title: "Joining Community Garden",
      message: "Please confirm with your passkey...",
      icon: "🌱",
    });

    try {
      await joinGarden(undefined, { silent: true });

      // Dismiss loading toast
      toastService.dismiss(loadingToastId);

      // Show success toast indicating they can start gardening
      toastService.success({
        title: "Welcome to Green Goods!",
        message: "You can now start submitting work to gardens.",
        icon: "🌱",
        duration: 6000,
        suppressLogging: true,
      });
    } catch (error) {
      // Dismiss loading toast
      toastService.dismiss(loadingToastId);

      // Check if user cancelled/declined the passkey signing
      const isCancelled =
        error instanceof Error &&
        (error.message.toLowerCase().includes("cancel") ||
          error.message.toLowerCase().includes("abort") ||
          error.message.toLowerCase().includes("denied") ||
          error.message.toLowerCase().includes("user refused"));

      // Already a gardener - silent success
      if (isAlreadyGardenerError(error)) {
        markOnboarded(primaryAddress);
        toastService.success({
          title: "Already a member!",
          message: "You can start submitting work to gardens.",
          icon: "🌱",
          duration: 4000,
          suppressLogging: true,
        });
        return;
      }

      if (isCancelled) {
        // User declined - show friendly message pointing to profile
        toastService.info({
          title: "No problem!",
          message: "You can join a garden anytime from your profile.",
          icon: "👋",
          duration: 5000,
          action: {
            label: "Go to Profile",
            onClick: () => {
              window.location.href = "/profile";
            },
            dismissOnClick: true,
            testId: "go-to-profile-action",
          },
          suppressLogging: true,
        });
      } else {
        // Actual error - show error message pointing to profile
        toastService.error({
          title: "Couldn't join garden",
          message: "You can try again from your profile.",
          error,
          action: {
            label: "Go to Profile",
            onClick: () => {
              window.location.href = "/profile";
            },
            dismissOnClick: true,
          },
        });
      }
    }
  }, [rootGarden?.address, primaryAddress, joinGarden, markOnboarded]);

  return {
    isLoading: isLoading || isPending,
    joinGarden,
    dismissPrompt,
    promptToJoin,
    rootGardenAddress: rootGarden?.address,
  };
}
