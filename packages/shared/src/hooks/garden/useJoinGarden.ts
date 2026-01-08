/**
 * Join Garden Hook
 *
 * Provides functionality to join any garden that has openJoining enabled.
 * Also includes utility to check if a garden allows open joining.
 *
 * @module hooks/garden/useJoinGarden
 */

import { useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useState } from "react";
import { encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID, getDefaultChain } from "../../config/blockchain";
import type { PasskeySession } from "../../modules/auth/passkey";
import { isAddressInList } from "../../utils/blockchain/address";
import { simulateJoinGarden } from "../../utils/contract/simulation";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { isAlreadyGardenerError } from "../../utils/errors/contract-errors";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";

/**
 * Check if a garden has openJoining enabled on-chain
 */
export async function checkGardenOpenJoining(gardenAddress: string): Promise<boolean> {
  try {
    const isOpen = await readContract(wagmiConfig, {
      address: gardenAddress as `0x${string}`,
      abi: GardenAccountABI,
      functionName: "openJoining",
    });
    return Boolean(isOpen);
  } catch (error) {
    console.warn(`Failed to check openJoining for ${gardenAddress}:`, error);
    return false;
  }
}

// Pending joins storage for optimistic UI
const PENDING_JOINS_KEY = "greengoods:pending-joins";
const PENDING_JOIN_TTL = 5 * 60 * 1000; // 5 minutes

function getPendingJoins(): Record<string, { address: string; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Store a pending join for immediate UI feedback.
 * Used when joining a garden but before the indexer has processed the event.
 * Exported for use by useAutoJoinRootGarden hook.
 */
export function addPendingJoin(gardenId: string, userAddress: string) {
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

  /**
   * Join a garden by its address/ID
   *
   * @param gardenAddress - The garden contract address to join
   * @param sessionOverride - Optional passkey session (used during login flow)
   * @returns Transaction hash
   */
  const joinGarden = useCallback(
    async (gardenAddress: string, sessionOverride?: PasskeySession): Promise<string> => {
      const targetAddress = sessionOverride?.address ?? primaryAddress;
      const client = sessionOverride?.client ?? smartAccountClient;

      if (!gardenAddress || !targetAddress) {
        throw new Error("Missing garden address or user address");
      }

      setState((prev) => ({
        ...prev,
        isJoining: true,
        joiningGardenId: gardenAddress,
        error: null,
      }));

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
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) });
        }, 10000);

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
          addPendingJoin(gardenAddress, targetAddress);
          setState((prev) => ({
            ...prev,
            isJoining: false,
            joiningGardenId: null,
            error: null,
          }));
          return "already-member";
        }

        setState((prev) => ({
          ...prev,
          isJoining: false,
          joiningGardenId: null,
          error: error instanceof Error ? error : new Error("Failed to join garden"),
        }));

        throw error;
      }
    },
    [primaryAddress, smartAccountClient, writeContractAsync, chainId, queryClient]
  );

  return {
    joinGarden,
    isJoining: state.isJoining || isPending,
    joiningGardenId: state.joiningGardenId,
    error: state.error,
    checkOpenJoining: checkGardenOpenJoining,
  };
}
