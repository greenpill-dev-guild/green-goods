import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import type { Address } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { gardenersKeys, roleKeys } from "../../config/query-keys/identity";
import { createTracker } from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import {
  recordGardenDeparture,
  forgetGardenDeparture,
  getGardenDepartureBlock,
  withoutDepartedMembers,
} from "../../modules/garden/garden-departures";
import {
  createDefaultLeaveGardenPorts,
  leaveGarden as submitLeave,
  reconcileLeaveGarden,
  type LeaveGardenCommand,
} from "../../modules/garden/leave-garden-command";
import { readMembershipAfterDeparture } from "../../modules/garden/garden-departure-reads";
import { removePendingJoin } from "../../modules/garden/pending-joins";
import type { Garden } from "../../types/domain";
import { readGardenLeaveAvailability } from "../../modules/garden/garden-leave-availability";
import { useGardenLeaveStore } from "../../stores/useGardenLeaveStore";
import { TransactionConfirmationPendingError } from "../../modules/transactions/types";
import { readGardenMembership } from "../../utils/blockchain/garden-role-reads";
import { isNotGardenMemberError, parseContractError } from "../../utils/errors/contract-errors";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";

const trackLeave = createTracker<{ outcome: string; authMode: string; errorFamily?: string }>(
  "garden_leave"
);

/** Online-only self departure. All hats go through the module's normal revoke path. */
export function useLeaveGarden(gardenAddress: Address) {
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
    mutationFn: async (mode: "leave" | "reconcile") => {
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
      const recovering =
        mode === "reconcile" ||
        Boolean(useGardenLeaveStore.getState().load({ gardenAddress, userAddress, chainId }));
      const confirmed = async (_command?: LeaveGardenCommand, blockNumber = 0n) => {
        let rejoined = false;
        if (recovering) {
          try {
            const fence = getGardenDepartureBlock(chainId, gardenAddress, userAddress) ?? 0n;
            const minimum = fence > blockNumber ? fence : blockNumber;
            rejoined = await readMembershipAfterDeparture(
              chainId,
              gardenAddress,
              userAddress,
              minimum
            );
            // A later confirmed departure cannot be erased by this older recovery read.
            if ((getGardenDepartureBlock(chainId, gardenAddress, userAddress) ?? 0n) > minimum)
              rejoined = false;
          } catch {
            /* An unknown current role cannot negate the confirmed departure. */
          }
        }
        if (rejoined) forgetGardenDeparture(chainId, gardenAddress, userAddress);
        else {
          recordGardenDeparture(chainId, gardenAddress, userAddress, blockNumber);
          removePendingJoin(gardenAddress, userAddress);
          queryClient.setQueryData<Garden[]>(gardensKeys.byChain(chainId), (gardens) =>
            gardens ? withoutDepartedMembers(gardens, chainId) : gardens
          );
        }
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
        return hash;
      } catch (error) {
        // A previous uncertain send or another tab may already have left. Reconcile only after
        // the chain confirms that no role remains; never interpret an RPC failure as departure.
        if (
          isNotGardenMemberError(error) &&
          (await readGardenMembership(gardenAddress, userAddress, chainId)) === false
        ) {
          await confirmed();
          trackLeave({ outcome: "already_left", authMode: authMode ?? "unknown" });
          return null;
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
    },
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
