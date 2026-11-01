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
import {
  createDefaultJoinGardenPorts,
  joinGarden as submitJoinGarden,
} from "../../modules/garden/join-garden-command";
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
import { useDocumentEvent } from "../utils/useEventListener";
import { useDelayedInvalidation, useTimeout } from "../utils/useTimeout";

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

// Pending joins storage for optimistic UI
const PENDING_JOINS_KEY = "greengoods:pending-joins";
const PENDING_JOIN_TTL = 15 * 60 * 1000; // 15 minutes — generous to avoid UI flash during indexer lag

// In-tab subscriber pattern. localStorage's `storage` event only fires across
// tabs; this lets same-tab consumers (useMemo on garden filters) retrigger
// when a join confirms or expires inside the current tab.
const pendingJoinsSubscribers = new Set<() => void>();
function notifyPendingJoinsChanged() {
  for (const listener of pendingJoinsSubscribers) {
    listener();
  }
}

function getPendingJoins(): Record<string, { address: string; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
  } catch {
    return {};
  }
}

function addPendingJoin(gardenId: string, userAddress: string, timestamp = Date.now()) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  const existing = pending[gardenId];
  if (
    existing &&
    existing.address.toLowerCase() === userAddress.toLowerCase() &&
    Date.now() - existing.timestamp < PENDING_JOIN_TTL
  ) {
    return;
  }
  pending[gardenId] = { address: userAddress, timestamp };
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
  notifyPendingJoinsChanged();
}

// Idempotent: must not notify when nothing changed. `isGardenMember` (a render-
// path predicate) calls this to clean up confirmed/expired pendings, and an
// unconditional notify would re-trigger any memo subscribed via
// `usePendingJoinsVersion`, producing an infinite render loop the moment the
// indexer-confirmed gardener list and the local pending-join overlap (e.g.
// immediately post-login on the auto-join-community-garden flow).
function removePendingJoin(gardenId: string) {
  const pending = getPendingJoins();
  if (!(gardenId in pending)) return;
  delete pending[gardenId];
  try {
    localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
    notifyPendingJoinsChanged();
  } catch (error) {
    // Storage can refuse the write. Nothing changed, so no one is told; readers go by the limit.
    logger.warn("Could not forget a settled pending join", { source: "removePendingJoin", error });
  }
}

/**
 * Subscribe to pending-join changes inside this tab. Used by garden-membership
 * filter memos so optimistic UI updates immediately on join/release without
 * waiting for an unrelated render trigger. A join the indexer never lists has
 * no such trigger when its limit passes, so each subscriber also keeps the time.
 *
 * @returns an incrementing counter; use it as a `useMemo`/`useEffect` dep.
 */
export function usePendingJoinsVersion(): number {
  const [version, setVersion] = useState(0);
  const { set: setLimitTimer } = useTimeout();
  useEffect(() => {
    const listener = () => setVersion((prev) => prev + 1);
    pendingJoinsSubscribers.add(listener);
    return () => {
      pendingJoinsSubscribers.delete(listener);
    };
  }, []);
  // Each change re-arms the timer: a new join may be the next to lapse.
  useEffect(() => {
    const settle = () => {
      const wait = forgetLapsedPendingJoins();
      if (wait !== null) setLimitTimer(settle, wait);
    };
    settle();
  }, [version, setLimitTimer]);
  // A sleeping device holds timers back, so a screen that comes back checks the clock at once.
  useDocumentEvent("visibilitychange", forgetLapsedPendingJoins);
  return version;
}

/** Saved pending joins, read as untrusted data: another build or a hand edit may have written them. */
function savedPendingJoins(): Record<string, unknown> {
  const saved: unknown = getPendingJoins();
  return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
}

/** A saved pending join's account, lower-cased, and its limit, or null for a malformed record. */
function readPendingJoin(record: unknown): { account: string; limit: number } | null {
  const { address, timestamp } = (record ?? {}) as { address?: unknown; timestamp?: unknown };
  if (typeof address !== "string" || typeof timestamp !== "number") return null;
  return { account: address.toLowerCase(), limit: timestamp + PENDING_JOIN_TTL };
}

/**
 * The gardens, lower-cased, where this device holds a fresh open join for the account: a join
 * sent on-chain that the garden's roster may not show yet. Reads only. A join request waiting
 * for a steward never lands here: it grants nothing.
 */
export function pendingJoinGardenIds(account: string): Set<string> {
  const member = account.toLowerCase();
  const now = Date.now();
  const gardenIds = new Set<string>();
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    const join = readPendingJoin(record);
    if (join?.account === member && now <= join.limit) gardenIds.add(gardenId.toLowerCase());
  }
  return gardenIds;
}

/**
 * Forget this device's open joins for the account in gardens whose roster now lists it, so a
 * role removed later is not masked by the join that came before it. Notifies only on a change.
 */
export function forgetListedPendingJoins(account: string, listedGardenIds: readonly string[]) {
  const listed = new Set(listedGardenIds.map((gardenId) => gardenId.toLowerCase()));
  const member = account.toLowerCase();
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    if (listed.has(gardenId.toLowerCase()) && readPendingJoin(record)?.account === member) {
      removePendingJoin(gardenId);
    }
  }
}

/**
 * Forget the joins past their limit, whoever sent them: no reader counts them any more. Returns
 * how long until the next one lapses, a millisecond past its limit since readers count the limit
 * itself, or null if none is waiting. A saved timestamp can be anything, so the wait is capped:
 * past setTimeout's range a delay fires at once, over and over.
 */
function forgetLapsedPendingJoins(): number | null {
  const now = Date.now();
  const limits: number[] = [];
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    const join = readPendingJoin(record);
    if (join && now > join.limit) removePendingJoin(gardenId);
    else if (join) limits.push(join.limit);
  }
  return limits.length > 0 ? Math.min(...limits, now + PENDING_JOIN_TTL) + 1 - now : null;
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
    () => queryClient.invalidateQueries({ queryKey: gardensKeys.byChain(chainId) }),
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

        // Optimistic update: add user to garden's gardeners list
        queryClient.setQueryData(
          gardensKeys.byChain(chainId),
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
