/**
 * useVoucherConsole Hook
 *
 * The voucher bookings beside a garden's pool console (PRD-1297 surface 6), published through the
 * `usePoolConsoleController` leaf: what the console reads, the clock its acceptance checks run on,
 * and the issuer's reviewed Safe transaction files.
 *
 * @module hooks/admin-ui/pool/useVoucherConsole
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import { UNAVAILABLE_VOUCHER_CONSOLE } from "../../../modules/commitment-pooling/voucher-console";
import {
  prepareVoucherSafeFile,
  readLiveVoucherConsole,
  type VoucherSafeFile,
} from "../../../modules/commitment-pooling/voucher-console-live";
import { claimActKey } from "../../../modules/transactions/act-phase";
import type { Address } from "../../../types/domain";
import { createMutationErrorHandler } from "../../../utils/errors/mutation-error-handler";
import { useExpiryClock } from "../../commitment-pooling/useExpiryClock";
import type { VoucherConsoleActs, VoucherConsoleView } from "./controller.types";

/** The voucher console's clock ticks only past its asks' deadlines, never a promise's due date. */
const NO_PROMISES: readonly CommitmentReadModel[] = [];
const NO_CYCLE_ENDS: ReadonlyMap<string, bigint | null> = new Map();

/** Downloaded proposals never change observed approval, custody or final delivery. */
function downloadSafeFile(file: VoucherSafeFile) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `voucher-${file.meta.createdFromSafeAddress}-${file.createdAt}.json`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Canonical voucher reads and reviewed Safe files; execution remains with the Safe signers. */
export function useVoucherConsole(input: { chainId: number; garden: Address }): VoucherConsoleView {
  const { chainId, garden } = input;
  const { formatMessage } = useIntl();
  const query = useQuery({
    queryKey: commitmentPoolingKeys.voucherConsole(chainId, garden),
    queryFn: () => readLiveVoucherConsole(input),
    staleTime: (query) =>
      query.state.data?.evidence === "local-rehearsal" ? Number.POSITIVE_INFINITY : 15_000,
    refetchInterval: (query) => (query.state.data?.evidence === "local-rehearsal" ? false : 30_000),
    retry: false,
  });
  const snapshot = query.data ?? UNAVAILABLE_VOUCHER_CONSOLE;
  // Acceptance deadlines are in source time, the pool's chain, whose clock ticks past each one.
  const deadlines = useMemo(
    () => snapshot.asks.flatMap((ask) => (ask.setup ? [BigInt(ask.setup.acceptBy)] : [])),
    [snapshot.asks]
  );
  const clock = useExpiryClock({
    chainId,
    commitments: NO_PROMISES,
    cycleEndTimes: NO_CYCLE_ENDS,
    deadlines,
  });
  const lookups = useMemo(() => {
    const asks = new Map(
      snapshot.asks.map((ask) => [claimActKey(ask.commitmentId, ask.buyer), ask] as const)
    );
    const bookings = new Map(
      snapshot.bookings.map((booking) => [booking.commitmentId.toString(), booking] as const)
    );
    return {
      askFor: (commitmentId: bigint, buyer: Address) => asks.get(claimActKey(commitmentId, buyer)),
      bookingFor: (commitmentId: bigint) => bookings.get(commitmentId.toString()),
    };
  }, [snapshot]);
  const acts = useMemo((): VoucherConsoleActs => {
    // Retry Transfer is one tap from its row, with no dialog to say it failed: the shared toast
    // does, in the steward's language.
    const reportRetryError = createMutationErrorHandler({
      source: "useVoucherConsole",
      toastContext: "voucher transfer",
      formatMessage,
      getFallbackTitle: () =>
        formatMessage({
          id: "cockpit.garden.pool.voucher.retry.failedTitle",
          defaultMessage: "The transfer wasn’t retried",
        }),
      getFallbackMessage: () =>
        formatMessage({
          id: "cockpit.garden.pool.voucher.retry.failedBody",
          defaultMessage: "Nothing changed. You can retry the same transfer.",
        }),
    });
    return {
      approveBooking: async (ask) =>
        downloadSafeFile(
          await prepareVoucherSafeFile({ chainId, garden }, { kind: "approve", ask })
        ),
      proposeReturn: async (booking, ceiling) =>
        downloadSafeFile(
          await prepareVoucherSafeFile({ chainId, garden }, { kind: "return", booking, ceiling })
        ),
      reportVisit: async () => {
        throw new Error("Add visit evidence through the promise's evidence flow");
      },
      raiseAllowance: async () => {
        throw new Error("Published reserve policy is required before preparing a new allowance");
      },
      // A failed retry leaves its row as it was, to try again; the toast says it failed.
      retryTransfer: async (booking) => {
        try {
          downloadSafeFile(
            await prepareVoucherSafeFile({ chainId, garden }, { kind: "retry", booking })
          );
        } catch (error) {
          reportRetryError(error, {
            gardenAddress: garden,
            metadata: { act: "retryTransfer", commitmentId: booking.commitmentId.toString() },
          });
        }
      },
    };
  }, [chainId, formatMessage, garden]);
  return {
    snapshot,
    // The chain's time, never before the read's own: a deadline passes between reads too.
    now: Math.max(snapshot.observedAt, Number(clock)),
    ...lookups,
    acts,
  };
}
