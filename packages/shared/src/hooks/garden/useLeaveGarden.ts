import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import type { Address } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { gardenersKeys, roleKeys } from "../../config/query-keys/identity";
import { createTracker } from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import { readRolesAfterDeparture } from "../../modules/garden/garden-departure-reads";
import {
  getGardenFenceBlock,
  recordGardenDeparture,
  recordGardenRegrant,
  withoutDepartedMembers,
} from "../../modules/garden/garden-departures";
import { readGardenLeaveAvailability } from "../../modules/garden/garden-leave-availability";
import {
  createDefaultLeaveGardenPorts,
  type LeaveGardenCommand,
  reconcileLeaveGarden,
  leaveGarden as submitLeave,
} from "../../modules/garden/leave-garden-command";
import { gardenMembership } from "../../modules/garden/membership";
import { pendingJoinGardenIds, removePendingJoin } from "../../modules/garden/pending-joins";
import {
  getTransactionScopeKey,
  TransactionConfirmationPendingError,
} from "../../modules/transactions/types";
import {
  gardenLeaveScope,
  subscribeToGardenLeaveStorage,
  useGardenLeaveStore,
  withGardenLeaveLock,
} from "../../stores/useGardenLeaveStore";
import type { Garden } from "../../types/domain";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { isNotGardenMemberError, parseContractError } from "../../utils/errors/contract-errors";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { getGardenRecordOptions } from "./useGardenRecord";
import { useGardens } from "../blockchain/useBaseLists";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/** Profile keeps every held role and saved receipt reachable, including a departed garden. */
export function useGardenDepartureOptions() {
  useEffect(subscribeToGardenLeaveStorage, []);
  const { primaryAddress } = useUser();
  const { data: gardens } = useGardens(DEFAULT_CHAIN_ID);
  const submissions = useGardenLeaveStore((state) => state.pending);
  const knownGardens = gardens ?? [];
  const prefix = primaryAddress
    ? `${getTransactionScopeKey(primaryAddress, DEFAULT_CHAIN_ID)}:`
    : "";
  const missing = prefix
    ? Object.keys(submissions).flatMap((key) => {
        if (!key.startsWith(prefix)) return [];
        const address = key.slice(prefix.length);
        return /^0x[a-f0-9]{40}$/.test(address) &&
          !knownGardens.some((garden) => garden.id.toLowerCase() === address)
          ? [address as Address]
          : [];
      })
    : [];
  const olderGardens = useQueries({ queries: missing.map(getGardenRecordOptions) });
  if (!primaryAddress) return [];
  return [
    ...knownGardens,
    ...olderGardens.flatMap((query) => (query.data ? [query.data] : [])),
  ].flatMap((garden) => {
    const roles: GardenRole[] = [...gardenMembership(garden, primaryAddress).roles];
    if (garden.funders?.some((account) => account.toLowerCase() === primaryAddress.toLowerCase()))
      roles.push("funder");
    if (
      garden.communities?.some((account) => account.toLowerCase() === primaryAddress.toLowerCase())
    )
      roles.push("community");
    const hasPendingDeparture = Boolean(
      submissions[
        gardenLeaveScope({
          gardenAddress: garden.id as Address,
          userAddress: primaryAddress,
          chainId: DEFAULT_CHAIN_ID,
        })
      ]
    );
    return roles.length || hasPendingDeparture ? [{ garden, roles, hasPendingDeparture }] : [];
  });
}

const trackLeave = createTracker<{ outcome: string; authMode: string; errorFamily?: string }>(
  "garden_leave"
);

/** Online-only self departure. All hats go through the module's normal revoke path. */
export function useLeaveGarden(gardenAddress: Address) {
  useEffect(subscribeToGardenLeaveStorage, []);
  const { primaryAddress, ready, authMode } = useUser();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = DEFAULT_CHAIN_ID;
  const capability = useQuery({
    queryKey: gardensKeys.leaveCapability(gardenAddress, primaryAddress ?? undefined, chainId),
    queryFn: () =>
      primaryAddress
        ? readGardenLeaveAvailability(gardenAddress, primaryAddress, chainId)
        : Promise.resolve("unknown" as const),
    enabled: false,
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const pending = useGardenLeaveStore((state) =>
    primaryAddress ? state.load({ gardenAddress, userAddress: primaryAddress, chainId }) : undefined
  );
  const identity = `${chainId}:${gardenAddress.toLowerCase()}:${primaryAddress?.toLowerCase()}:${authMode}:${ready}`;
  const session = useRef({ identity, sender });
  if (session.current.identity !== identity || session.current.sender !== sender)
    session.current = { identity, sender };
  useEffect(
    () => () => {
      session.current = { ...session.current };
    },
    []
  );

  const mutation = useMutation({
    networkMode: "always",
    mutationFn: (mode: "leave" | "reconcile") =>
      withGardenLeaveLock(async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine)
          throw new Error(formatMessage({ id: "app.garden.leave.offline" }));
        if (!primaryAddress || !ready || !sender) {
          throw new Error(formatMessage({ id: "app.garden.leave.session" }));
        }
        const userAddress = primaryAddress as Address;
        const origin = session.current;
        const assertOwnership = () => {
          if (session.current !== origin)
            throw new Error(formatMessage({ id: "app.garden.leave.session" }));
        };
        const submission = { gardenAddress, userAddress, chainId };
        const savedReceipt = useGardenLeaveStore.getState().load(submission);
        const recovering = mode === "reconcile" || Boolean(savedReceipt);
        const hasPendingJoin = () =>
          pendingJoinGardenIds(userAddress).has(gardenAddress.toLowerCase());
        let departed = true;
        const confirmed = async (_command?: LeaveGardenCommand, blockNumber = 0n) => {
          let regrant: Awaited<ReturnType<typeof readRolesAfterDeparture>>;
          if (recovering) {
            const fence = getGardenFenceBlock(chainId, gardenAddress, userAddress) ?? 0n;
            const minimum = fence > blockNumber ? fence : blockNumber;
            try {
              regrant = await readRolesAfterDeparture(chainId, gardenAddress, userAddress, minimum);
              // An older receipt cannot undo a departure recorded while its role read was running.
              if (
                regrant &&
                (getGardenFenceBlock(chainId, gardenAddress, userAddress) ?? 0n) > regrant.block
              )
                regrant = undefined;
            } catch {
              /* The saved receipt stays available if current membership cannot be verified. */
            }
            if (!regrant?.complete && !regrant?.roles.length) {
              if (savedReceipt) throw new TransactionConfirmationPendingError(savedReceipt);
              throw new Error("Current garden membership could not be verified");
            }
          }
          departed = !regrant?.roles.length;
          recordGardenDeparture(chainId, gardenAddress, userAddress, blockNumber);
          if (regrant) recordGardenRegrant(chainId, gardenAddress, userAddress, regrant);
          // Legacy receipts lack ordering metadata. Preserve a marker when its order is unknown.
          const submittedAt = useGardenLeaveStore.getState().load(submission)?.submittedAt;
          if (submittedAt !== undefined) removePendingJoin(gardenAddress, userAddress, submittedAt);
          queryClient.setQueryData<Garden[]>(gardensKeys.byChain(chainId), (gardens) =>
            gardens ? withoutDepartedMembers(gardens, chainId) : gardens
          );
          // Cancel pre-departure role reads before making their cached answers stale.
          void queryClient
            .cancelQueries({ queryKey: roleKeys.all })
            .then(() => queryClient.resetQueries({ queryKey: roleKeys.all }));
          void queryClient.invalidateQueries({ queryKey: gardensKeys.all });
          void queryClient.invalidateQueries({ queryKey: gardenersKeys.all });
        };
        trackLeave({ outcome: "started", authMode: authMode ?? "unknown" });
        try {
          const hash = await (mode === "reconcile" ? reconcileLeaveGarden : submitLeave)(
            { gardenAddress, userAddress, chainId },
            createDefaultLeaveGardenPorts({
              transactionSender: sender,
              assertOwnership,
              pending: useGardenLeaveStore.getState(),
              confirmed,
            })
          );
          trackLeave({
            outcome: recovering ? "reconciled" : "success",
            authMode: authMode ?? "unknown",
          });
          return { hash, departed };
        } catch (error) {
          // A previous uncertain send or another tab may already have left. Reconcile only after
          // the chain confirms that no role remains; never interpret an RPC failure as departure.
          if (!recovering && isNotGardenMemberError(error) && !hasPendingJoin()) {
            const minimum = getGardenFenceBlock(chainId, gardenAddress, userAddress) ?? 0n;
            const snapshot = await readRolesAfterDeparture(
              chainId,
              gardenAddress,
              userAddress,
              minimum
            ).catch(() => undefined);
            if (
              snapshot?.complete &&
              snapshot.roles.length === 0 &&
              snapshot.block >= (getGardenFenceBlock(chainId, gardenAddress, userAddress) ?? 0n) &&
              !hasPendingJoin()
            ) {
              await confirmed(undefined, snapshot.block);
              trackLeave({ outcome: "already_left", authMode: authMode ?? "unknown" });
              return { hash: null, departed: true };
            }
          }
          const cancelled = isCancelledTxError(error);
          const pending = error instanceof TransactionConfirmationPendingError;
          trackLeave({
            outcome: cancelled ? "cancelled" : pending ? "pending" : "failed",
            authMode: authMode ?? "unknown",
            errorFamily: parseContractError(error).name,
          });
          if (!cancelled && !pending)
            logger.error("Could not leave garden", { source: "useLeaveGarden", error });
          throw error;
        }
      }),
  });
  return {
    availability: capability.isFetching
      ? ("checking" as const)
      : (capability.data ?? ("unknown" as const)),
    checkAvailability: capability.refetch,
    hasPendingDeparture: Boolean(pending),
    reconcileDeparture: () => mutation.mutateAsync("reconcile"),
    leaveGarden: () => mutation.mutateAsync("leave"),
    isLeaving: mutation.isPending,
    error: mutation.error,
  };
}
