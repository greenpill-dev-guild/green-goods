/**
 * Join Garden Hook
 *
 * Provides functionality to join any garden that has openJoining enabled.
 * Also includes utility to check if a garden allows open joining.
 *
 * @module hooks/garden/useJoinGarden
 */

import { useQueryClient } from "@tanstack/react-query";
import type { Garden } from "../../types/domain";
import { readContract } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { useWriteContract } from "wagmi";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID, getDefaultChain } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
import {
  trackGardenJoinAlreadyMember,
  trackGardenJoinFailed,
  trackGardenJoinStarted,
  trackGardenJoinSuccess,
} from "../../modules/app/analytics-events";
import {
  addBreadcrumb,
  trackContractError,
  trackNetworkError,
} from "../../modules/app/error-tracking";
import { isAddressInList } from "../../utils/blockchain/address";

/**
 * Session data for passkey authentication.
 * Used when calling joinGarden during login flow.
 */
interface PasskeySession {
  address: Hex;
  client: SmartAccountClient | null;
}

import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { simulateJoinGarden } from "../../utils/blockchain/simulation";
import { isAlreadyGardenerError } from "../../utils/errors/contract-errors";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

/**
 * Check if a garden has openJoining enabled on-chain
 */
export async function checkGardenOpenJoining(gardenAddress: Address): Promise<boolean> {
  try {
    const isOpen = await readContract(wagmiConfig, {
      address: gardenAddress as `0x${string}`,
      abi: GardenAccountABI,
      functionName: "openJoining",
    });
    return Boolean(isOpen);
  } catch (error) {
    logger.warn("Failed to check openJoining", {
      source: "checkGardenOpenJoining",
      gardenAddress,
      error,
    });
    trackNetworkError(error, {
      source: "checkGardenOpenJoining",
      userAction: "checking if garden allows open joining",
      recoverable: true,
      metadata: {
        garden_address: gardenAddress,
        function_name: "openJoining",
        is_offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
      },
    });
    return false;
  }
}

// Pending joins storage for optimistic UI
const PENDING_JOINS_KEY = "greengoods:pending-joins";
const PENDING_JOIN_TTL = 15 * 60 * 1000; // 15 minutes — generous to avoid UI flash during indexer lag

function getPendingJoins(): Record<string, { address: string; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
  } catch {
    return {};
  }
}

function addPendingJoin(gardenId: string, userAddress: string) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  pending[gardenId] = { address: userAddress, timestamp: Date.now() };
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
}

function removePendingJoin(gardenId: string) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  delete pending[gardenId];
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
}

/**
 * Check if user is a member of a garden (gardener or operator).
 * Also checks pending joins for immediate UI feedback after successful transaction.
 */
export function isGardenMember(
  userAddress: string | null | undefined,
  gardeners: string[] | null | undefined,
  operators: string[] | null | undefined,
  gardenId?: string
): boolean {
  if (!userAddress) return false;

  // Check actual membership
  if (isAddressInList(userAddress, gardeners) || isAddressInList(userAddress, operators)) {
    if (gardenId) removePendingJoin(gardenId); // Cleanup if confirmed
    return true;
  }

  // Check pending joins for optimistic UI
  if (gardenId) {
    const pending = getPendingJoins()[gardenId];
    if (pending && pending.address.toLowerCase() === userAddress.toLowerCase()) {
      if (Date.now() - pending.timestamp > PENDING_JOIN_TTL) {
        removePendingJoin(gardenId);
        return false;
      }
      return true;
    }
  }

  return false;
}

interface JoinGardenState {
  isJoining: boolean;
  joiningGardenId: string | null;
  error: Error | null;
}

/**
 * Hook for joining any garden with openJoining enabled.
 *
 * Features:
 * - Join any garden by address/ID
 * - Supports both passkey (smart account) and wallet authentication
 * - For passkey users: Transaction is sponsored via Pimlico paymaster
 * - For wallet users: User pays gas fees directly (simulates first)
 * - Automatically invalidates garden queries after joining
 *
 * @returns Join function and state
 */
export function useJoinGarden() {
  const { formatMessage } = useIntl();
  const { smartAccountAddress, smartAccountClient, eoa } = useUser();
  const walletAddress = eoa?.address;
  const primaryAddress = smartAccountAddress || walletAddress;

  const networkConfig = getDefaultChain();
  const chainId = Number(networkConfig.chainId ?? DEFAULT_CHAIN_ID);
  const queryClient = useQueryClient();

  const { writeContractAsync, isPending } = useWriteContract();

  const [state, setState] = useState<JoinGardenState>({
    isJoining: false,
    joiningGardenId: null,
    error: null,
  });
  const isJoiningRef = useRef(false);

  // Memoized invalidation callback for gardens
  const invalidateGardens = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) }),
    [queryClient, chainId]
  );

  // Use delayed invalidation with automatic cleanup on unmount
  // 10 seconds for indexer to process
  const { start: scheduleGardenSync } = useDelayedInvalidation(invalidateGardens, 10000);

  /**
   * Join a garden by its address/ID
   *
   * @param gardenAddress - The garden contract address to join
   * @param sessionOverride - Optional passkey session (used during login flow)
   * @returns Transaction hash
   */
  const joinGarden = useCallback(
    async (gardenAddress: string, sessionOverride?: PasskeySession): Promise<string> => {
      // Prevent concurrent join calls (double-tap guard)
      if (isJoiningRef.current) {
        return "already-joining";
      }
      isJoiningRef.current = true;

      const targetAddress = sessionOverride?.address ?? primaryAddress;
      const client = sessionOverride?.client ?? smartAccountClient;

      if (!gardenAddress || !targetAddress) {
        isJoiningRef.current = false;
        throw new Error(formatMessage({ id: "app.garden.joinMissingInfo" }));
      }

      // Track join started
      const authMode = client?.account ? "passkey" : "wallet";
      addBreadcrumb("garden_join_started", { gardenAddress, authMode });
      trackGardenJoinStarted({
        gardenAddress,
        authMode,
      });

      setState((prev) => ({
        ...prev,
        isJoining: true,
        joiningGardenId: gardenAddress,
        error: null,
      }));

      // Snapshot for rollback on error (before the try so it's visible in catch)
      const previousGardens = queryClient.getQueryData<Garden[]>(
        queryKeys.gardens.byChain(chainId)
      );

      try {
        let txHash: string;

        if (client?.account) {
          // Use smart account for passkey authentication (sponsored transaction)
          txHash = await client.sendTransaction({
            account: client.account,
            chain: client.chain,
            to: gardenAddress as `0x${string}`,
            value: 0n,
            data: encodeFunctionData({
              abi: GardenAccountABI,
              functionName: "joinGarden",
              args: [],
            }),
          });
        } else {
          // Use wagmi for wallet authentication (user pays gas)
          // Simulate first to catch errors before user pays gas
          const simulation = await simulateJoinGarden(
            gardenAddress as `0x${string}`,
            targetAddress as `0x${string}`
          );

          if (!simulation.success) {
            if (simulation.error) {
              const error = new Error(simulation.error.message);
              error.name = simulation.error.name;
              throw error;
            }
            throw new Error("Transaction simulation failed. Please try again.");
          }

          txHash = await writeContractAsync({
            address: gardenAddress as `0x${string}`,
            abi: GardenAccountABI,
            functionName: "joinGarden",
            args: [],
          });
        }

        // Store pending join for immediate UI feedback
        addPendingJoin(gardenAddress, targetAddress);

        // Optimistic update: add user to garden's gardeners list
        queryClient.setQueryData(
          queryKeys.gardens.byChain(chainId),
          (oldGardens: Garden[] | undefined) => {
            if (!oldGardens) return oldGardens;
            return oldGardens.map((garden) => {
              if (garden.id === gardenAddress) {
                const currentGardeners = garden.gardeners || [];
                if (!isAddressInList(targetAddress, currentGardeners)) {
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

        // Delayed sync - give indexer time to process the event
        // Uses useDelayedInvalidation for automatic cleanup on unmount
        scheduleGardenSync();

        // Track successful join
        trackGardenJoinSuccess({
          gardenAddress,
          txHash,
          authMode,
        });

        isJoiningRef.current = false;
        setState((prev) => ({
          ...prev,
          isJoining: false,
          joiningGardenId: null,
          error: null,
        }));

        return txHash;
      } catch (error) {
        // Special handling for AlreadyGardener error - not actually an error
        if (isAlreadyGardenerError(error)) {
          isJoiningRef.current = false;
          trackGardenJoinAlreadyMember({ gardenAddress });
          addPendingJoin(gardenAddress, targetAddress);
          setState((prev) => ({
            ...prev,
            isJoining: false,
            joiningGardenId: null,
            error: null,
          }));
          return "already-member";
        }

        // Rollback optimistic update
        if (previousGardens) {
          queryClient.setQueryData(queryKeys.gardens.byChain(chainId), previousGardens);
        }
        removePendingJoin(gardenAddress);

        // Track failed join - send both funnel event and structured exception
        trackGardenJoinFailed({
          gardenAddress,
          error: error instanceof Error ? error.message : "Unknown error",
          authMode,
        });

        // Also track as structured exception for PostHog error dashboard
        trackContractError(error, {
          source: "useJoinGarden",
          gardenAddress,
          authMode,
          userAction: "joining garden",
        });

        isJoiningRef.current = false;
        setState((prev) => ({
          ...prev,
          isJoining: false,
          joiningGardenId: null,
          error: error instanceof Error ? error : new Error("Failed to join garden"),
        }));

        throw error;
      }
    },
    [
      primaryAddress,
      smartAccountClient,
      writeContractAsync,
      chainId,
      queryClient,
      scheduleGardenSync,
      formatMessage,
    ]
  );

  return {
    joinGarden,
    isJoining: state.isJoining || isPending,
    joiningGardenId: state.joiningGardenId,
    error: state.error,
    checkOpenJoining: checkGardenOpenJoining,
  };
}
