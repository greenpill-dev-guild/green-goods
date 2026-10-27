/**
 * useVoucherConsole Hook
 *
 * The voucher bookings beside a garden's pool console (PRD-1297 surface 6), published through the
 * `usePoolConsoleController` leaf: what the console reads, the clock its acceptance checks run on,
 * and the issuer's acts, which refuse until the pilot deployment is adopted.
 *
 * @module hooks/admin-ui/pool/useVoucherConsole
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import {
  UNAVAILABLE_VOUCHER_CONSOLE,
  type VoucherConsoleSnapshot,
} from "../../../modules/commitment-pooling/voucher-console";
import { claimActKey } from "../../../modules/transactions/act-phase";
import type { Address } from "../../../types/domain";
import { createMutationErrorHandler } from "../../../utils/errors/mutation-error-handler";
import { useExpiryClock } from "../../commitment-pooling/useExpiryClock";
import type { VoucherConsoleActs, VoucherConsoleView } from "./controller.types";

/** The voucher console's clock ticks only past its asks' deadlines, never a promise's due date. */
const NO_PROMISES: readonly CommitmentReadModel[] = [];
const NO_CYCLE_ENDS: ReadonlyMap<string, bigint | null> = new Map();

/**
 * The issuer's acts sign with the issuer's Safe on the voucher network, which
 * the cockpit can't propose to yet, and the pilot deployment they would reach
 * isn't adopted: each refuses before anything reaches a wallet.
 */
const VOUCHER_PILOT_NOT_ADOPTED = "Voucher bookings open here once the pilot deployment is adopted";
const refuseUntilAdopted = () => Promise.reject(new Error(VOUCHER_PILOT_NOT_ADOPTED));
const VOUCHER_ACTS_NOT_ADOPTED: VoucherConsoleActs = {
  approveBooking: refuseUntilAdopted,
  reportVisit: refuseUntilAdopted,
  proposeReturn: refuseUntilAdopted,
  retryTransfer: refuseUntilAdopted,
  raiseAllowance: refuseUntilAdopted,
};

/**
 * The voucher console beside a garden's pool console (PRD-1297 surface 6): the
 * bookings asked in the pool, the bookings under way on its offers, the
 * issuer's reserve and its Safe's signature rule. The pilot's routes stay empty
 * until its deployment is adopted (`SERVICE_LIVE_ROUTES`), so the read answers
 * unavailable and the console shows only what the pool reads; Storybook seeds
 * the same key with the pilot's fictional bookings. The pool steward's
 * acceptance is the pool console's own act (`acceptServiceClaim`).
 */
export function useVoucherConsole(input: { chainId: number; garden: Address }): VoucherConsoleView {
  const { chainId, garden } = input;
  const { formatMessage } = useIntl();
  const query = useQuery({
    queryKey: commitmentPoolingKeys.voucherConsole(chainId, garden),
    queryFn: async (): Promise<VoucherConsoleSnapshot> => UNAVAILABLE_VOUCHER_CONSOLE,
    staleTime: Number.POSITIVE_INFINITY,
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
      ...VOUCHER_ACTS_NOT_ADOPTED,
      // A failed retry leaves its row as it was, to try again; the toast says it failed.
      retryTransfer: async (booking) => {
        try {
          await VOUCHER_ACTS_NOT_ADOPTED.retryTransfer(booking);
        } catch (error) {
          reportRetryError(error, {
            gardenAddress: garden,
            metadata: { act: "retryTransfer", commitmentId: booking.commitmentId.toString() },
          });
        }
      },
    };
  }, [formatMessage, garden]);
  return {
    snapshot,
    // The chain's time, never before the read's own: a deadline passes between reads too.
    now: Math.max(snapshot.observedAt, Number(clock)),
    ...lookups,
    acts,
  };
}
