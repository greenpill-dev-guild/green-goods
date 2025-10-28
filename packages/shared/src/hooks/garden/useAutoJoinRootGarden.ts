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
import { parseAndFormatError, isAlreadyGardenerError } from "../../utils/errors";
import { queryInvalidation } from "../query-keys";

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

  // Debug: Log initial configuration
  console.log("[useAutoJoinRootGarden] Hook initialized", {
    autoJoin,
    chainId,
    smartAccountAddress,
    hasSmartAccountClient: !!smartAccountClient,
    ready,
    rootGarden: rootGarden ? {
      address: rootGarden.address,
      tokenId: rootGarden.tokenId,
    } : null,
    gardensCount: gardens?.length || 0,
    gardensLoading,
  });

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
    error: onchainCheckError,
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

  // Debug: Log onchain check results
  console.log("[useAutoJoinRootGarden] Onchain membership check", {
    isGardenerOnchain,
    isCheckingOnchain,
    hasError: !!onchainCheckError,
    error: onchainCheckError,
    enabled: !!rootGarden?.address && !!smartAccountAddress,
  });

  // Fallback to indexer data for initial load, but prefer onchain data
  const derivedIsGardenerFromIndexer = useMemo(() => {
    const targetAddress = normalizeAddress(smartAccountAddress);
    if (!targetAddress) return false;
    const members = rootGardenRecord?.gardeners ?? [];
    return members.some((member) => normalizeAddress(member) === targetAddress);
  }, [rootGardenRecord?.gardeners, smartAccountAddress, normalizeAddress]);

  // Use onchain data when available, fall back to indexer
  const derivedIsGardener: boolean = Boolean(isGardenerOnchain) ?? derivedIsGardenerFromIndexer;

  // Debug: Log membership determination
  console.log("[useAutoJoinRootGarden] Membership status", {
    isGardenerOnchain,
    derivedIsGardenerFromIndexer,
    finalIsGardener: derivedIsGardener,
    rootGardenRecord: rootGardenRecord ? {
      id: rootGardenRecord.id,
      gardenersCount: rootGardenRecord.gardeners?.length || 0,
    } : null,
  });

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
      
      console.log("[checkMembership] Starting membership check", {
        targetAddress,
        addressOverride,
        smartAccountAddress,
      });

      if (!targetAddress) {
        console.warn("[checkMembership] No target address provided");
        return false;
      }

      try {
        // Refetch onchain status first (source of truth)
        console.log("[checkMembership] Refetching onchain status");
        const onchainResult = await refetchOnchainStatus();
        const isOnchainMember = onchainResult.data ?? false;
        
        console.log("[checkMembership] Onchain result", {
          isOnchainMember,
          hasData: onchainResult.data !== undefined,
        });

        // Also refetch indexer data for consistency
        console.log("[checkMembership] Refetching indexer data");
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

        // Prefer onchain status as source of truth
        const isMember = isOnchainMember || isMemberFromIndexer;

        console.log("[checkMembership] Final membership determination", {
          isOnchainMember,
          isMemberFromIndexer,
          isMember,
          hasMatch: !!match,
          gardenersInMatch: match?.gardeners?.length || 0,
        });

        if (isMember) {
          console.log("[checkMembership] User is a member, setting flags");
          const onboardKey = getOnboardedKey(targetAddress);
          localStorage.setItem(onboardKey, "true");
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          setState((prev) => ({ ...prev, isGardener: true }));
        } else {
          console.log("[checkMembership] User is NOT a member");
        }

        return isMember;
      } catch (err) {
        console.error("[checkMembership] Failed to check root garden membership", {
          error: err,
          errorMessage: (err as any)?.message,
        });
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

      console.log("[joinGarden] Starting join process", {
        targetAddress,
        smartAccountAddress,
        hasSessionOverride: !!sessionOverride,
        hasClientOverride: !!clientOverride,
        hasSmartAccountClient: !!smartAccountClient,
        rootGarden: rootGarden ? {
          address: rootGarden.address,
          tokenId: rootGarden.tokenId,
        } : null,
        chainId,
      });

      if (!rootGarden || !targetAddress) {
        console.error("[joinGarden] Missing required data:", {
          hasRootGarden: !!rootGarden,
          rootGardenAddress: rootGarden?.address,
          hasTargetAddress: !!targetAddress,
          targetAddress,
        });
        return;
      }

      try {
        const client = clientOverride ?? smartAccountClient;
        const authMode = client?.account ? "passkey" : "wallet";
        
        console.log("[joinGarden] Transaction details", {
          authMode,
          hasClient: !!client,
          hasAccount: !!client?.account,
          targetContract: rootGarden.address,
          functionName: "joinGarden",
          chainId,
        });

        if (client?.account) {
          // Use smart account for passkey authentication (sponsored transaction)
          console.log("[joinGarden] Sending passkey transaction (sponsored)", {
            account: client.account.address,
            chain: client.chain?.id,
            to: rootGarden.address,
          });

          const txHash = await client.sendTransaction({
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

          console.log("[joinGarden] Passkey transaction successful", {
            txHash,
            authMode: "passkey",
          });
        } else {
          // Use wagmi for wallet authentication (user pays gas)
          console.log("[joinGarden] Sending wallet transaction (user pays gas)", {
            address: rootGarden.address,
            functionName: "joinGarden",
          });

          const txHash = await writeContractAsync({
            address: rootGarden.address,
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          });

          console.log("[joinGarden] Wallet transaction successful", {
            txHash,
            authMode: "wallet",
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

        console.log("[joinGarden] Transaction confirmed, updating state");
        
        // Invalidate all garden-related queries using centralized pattern
        const keysToInvalidate = queryInvalidation.invalidateGardens(chainId);
        console.log("[joinGarden] Invalidating queries", {
          keysCount: keysToInvalidate.length,
          keys: keysToInvalidate,
        });
        
        await Promise.all(
          keysToInvalidate.map((key) =>
            queryClient.invalidateQueries({ queryKey: key })
          )
        );
        
        console.log("[joinGarden] Checking membership after join");
        await checkMembership(targetAddress);
        
        console.log("[joinGarden] Root garden join complete");
      } catch (error) {
        console.error("[joinGarden] Transaction failed", {
          error,
          errorString: String(error),
          errorMessage: (error as any)?.message,
          errorCode: (error as any)?.code,
          errorData: (error as any)?.data,
          errorShortMessage: (error as any)?.shortMessage,
        });

        const { parsed } = parseAndFormatError(error);
        console.log("[joinGarden] Parsed error details", {
          raw: parsed.raw,
          name: parsed.name,
          message: parsed.message,
          isKnown: parsed.isKnown,
        });
        
        // Special handling for AlreadyGardener error - not actually an error
        if (isAlreadyGardenerError(error)) {
          console.log("[joinGarden] AlreadyGardener error - treating as success");
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
          console.log("[joinGarden] State updated after AlreadyGardener");
          return; // Exit successfully
        }
        
        console.error("[joinGarden] Unhandled error - throwing", {
          errorName: parsed.name,
          errorMessage: parsed.message,
        });
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
