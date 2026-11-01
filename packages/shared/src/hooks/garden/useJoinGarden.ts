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
import type { SmartAccountClient } from "permissionless";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type Address, type Hex } from "viem";
import { useWriteContract } from "wagmi";
import { getWagmiConfig } from "../../config/appkit";
import { getDefaultChain } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  trackGardenJoinAlreadyMember,
  trackGardenJoinCancelled,
  trackGardenJoinFailed,
  trackGardenJoinStarted,
  trackGardenJoinSuccess,
} from "../../modules/app/analytics-events";
import {
  addBreadcrumb,
  trackContractError,
  trackNetworkError,
} from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { activeGardenScope } from "../../modules/garden/active-garden";
import {
  createDefaultJoinGardenPorts,
  joinGarden as submitJoinGarden,
} from "../../modules/garden/join-garden-command";
import {
  addPendingJoin,
  hasFreshPendingJoin,
  markOwnJoinEntry,
  removePendingJoin,
  subscribeToPendingJoins,
} from "../../modules/garden/pending-joins";
import { useActiveGardenStore } from "../../stores/useActiveGardenStore";
import type { Garden } from "../../types/domain";
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
import { isAlreadyGardenerError, parseContractError } from "../../utils/errors/contract-errors";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { gardensKeys } from "../../config/query-keys/garden";
import { useDelayedInvalidation } from "../utils/useTimeout";

/**
 * Check if a garden has openJoining enabled on-chain
 */
export async function checkGardenOpenJoining(gardenAddress: Address): Promise<boolean> {
  try {
    const isOpen = await readContract(getWagmiConfig(), {
      address: gardenAddress as `0x${string}`,
      abi: GardenAccountABI,
      functionName: "openJoining",
      chainId: Number(getDefaultChain().chainId ?? DEFAULT_CHAIN_ID),
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

/**
 * Subscribe to pending-join changes inside this tab. Used by garden-membership
 * filter memos so optimistic UI updates immediately on join/release without
 * waiting for an unrelated render trigger.
 *
 * @returns an incrementing counter; use it as a `useMemo`/`useEffect` dep.
 */
export function usePendingJoinsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return subscribeToPendingJoins(() => setVersion((prev) => prev + 1));
  }, []);
  return version;
}

/**
 * Check if user is a member of a garden (gardener or steward).
 * Also checks pending joins for immediate UI feedback after successful transaction.
 */
export function isGardenMember(
  userAddress: string | null | undefined,
  gardeners: string[] | null | undefined,
  stewards: string[] | null | undefined,
  gardenId?: string
): boolean {
  if (!userAddress) return false;

  // Check actual membership
  if (isAddressInList(userAddress, gardeners) || isAddressInList(userAddress, stewards)) {
    return true;
  }

  // Check pending joins for optimistic UI
  return gardenId ? hasFreshPendingJoin(gardenId, userAddress) : false;
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
    () => queryClient.invalidateQueries({ queryKey: gardensKeys.byChain(chainId) }),
    [queryClient, chainId]
  );

  // Use delayed invalidation with automatic cleanup on unmount
  // 10 seconds for indexer to process
  const { start: scheduleGardenSync } = useDelayedInvalidation(invalidateGardens, 10000);

  // A join is the member choosing the garden: it becomes the active one, whatever was active
  // before (DL-147). The pending join just recorded lists it as theirs until the roster does.
  const activateJoinedGarden = useCallback(
    (gardenAddress: string, account: string) => {
      const scope = activeGardenScope(chainId, account);
      if (scope) useActiveGardenStore.getState().rememberGarden(scope, gardenAddress);
    },
    [chainId]
  );

  /**
   * Join a garden by its address/ID, which also makes it the active garden (DL-147)
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
      const previousGardens = queryClient.getQueryData<Garden[]>(gardensKeys.byChain(chainId));

      try {
        const txHash = await submitJoinGarden(
          {
            gardenAddress: gardenAddress as Hex,
            userAddress: targetAddress as Hex,
            chainId,
            smartAccountClient: client,
          },
          createDefaultJoinGardenPorts({
            walletSend: ({ gardenAddress: targetGarden, chainId: targetChain }) =>
              writeContractAsync({
                address: targetGarden,
                abi: GardenAccountABI,
                functionName: "joinGarden",
                args: [],
                chainId: targetChain,
              }),
            recordPending: addPendingJoin,
          })
        );

        // Optimistic update: add user to garden's gardeners list, marked as the join's own entry so
        // the pending join stays until a read of the roster lists them (`useMyGardens`).
        queryClient.setQueryData(
          gardensKeys.byChain(chainId),
          (oldGardens: Garden[] | undefined) => {
            if (!oldGardens) return oldGardens;
            return oldGardens.map((garden) => {
              if (garden.id === gardenAddress) {
                const currentGardeners = garden.gardeners || [];
                if (!isAddressInList(targetAddress, currentGardeners)) {
                  return markOwnJoinEntry(
                    { ...garden, gardeners: [...currentGardeners, targetAddress] },
                    targetAddress
                  );
                }
              }
              return garden;
            });
          }
        );

        activateJoinedGarden(gardenAddress, targetAddress);

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
          activateJoinedGarden(gardenAddress, targetAddress);
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
          queryClient.setQueryData(gardensKeys.byChain(chainId), previousGardens);
        }
        removePendingJoin(gardenAddress);

        // A declined wallet or passkey prompt is a user decision, not a product
        // breakage. It still rolls back and rethrows like any other error, but it
        // stays out of the failure funnel and the error dashboard — counting
        // aborts as failures is what made `failures.conversion-kill` read a
        // two-person retry loop as a 66.7% garden_join conversion kill (PRD-717).
        if (isCancelledTxError(error)) {
          trackGardenJoinCancelled({ gardenAddress, authMode });
        } else {
          // Telemetry carries the parsed error family only — viem embeds the
          // signer address in raw wallet messages, and these values are quoted
          // into shared surfaces by the growth-pulse routine.
          const parsedErrorFamily = parseContractError(error).name;

          // Track failed join - send both funnel event and structured exception
          trackGardenJoinFailed({
            gardenAddress,
            error: parsedErrorFamily,
            parsedErrorFamily,
            authMode,
          });

          // Also track as structured exception for PostHog error dashboard
          trackContractError(error, {
            source: "useJoinGarden",
            gardenAddress,
            authMode,
            userAction: "joining garden",
          });
        }

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
      activateJoinedGarden,
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
