/**
 * useVoucherStart Hook
 *
 * The steward's start of a voucher booking they have just accepted (DL-193): record its
 * activation on the source, then send that decision to the escrow, each from the steward's own
 * wallet and each its own approval. Every send reads the booking from the chain again first. A
 * start that doesn't go leaves the booking accepted; the member's Start the Booking covers it.
 *
 * @module hooks/admin-ui/pool/useVoucherStart
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { recordSendAct } from "../../../modules/app/sendActAnalytics";
import { prepareVoucherStartSend } from "../../../modules/commitment-pooling/voucher-console-live";
import {
  runVoucherStart,
  type VoucherStartEvent,
  type VoucherStartOutcome,
  type VoucherStartStep,
} from "../../../modules/commitment-pooling/voucher-start";
import { claimActKey } from "../../../modules/transactions/act-phase";
import type { Address } from "../../../types/domain";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useTransactionSender } from "../../blockchain/useTransactionSender";

export type VoucherStartStepStatus = "waiting" | "signing" | "confirming" | "done" | "failed";

/** Where each of the start's two sends stands, for the dialog's list. */
export interface VoucherStartProgress {
  record: VoucherStartStepStatus;
  send: VoucherStartStepStatus;
  /** What the send to the escrow pays, once its fresh quote is asked for. */
  fee: bigint | null;
  hashes: Record<VoucherStartStep, Hex | null>;
}

export const VOUCHER_START_IDLE: VoucherStartProgress = {
  record: "waiting",
  send: "waiting",
  fee: null,
  hashes: { record: null, send: null },
};

/** The booking whose start to send, as the ask that was accepted names it. */
interface VoucherStartTarget {
  commitmentId: bigint;
  buyer: Address;
  setupId: Hex;
}

function apply(progress: VoucherStartProgress, event: VoucherStartEvent): VoucherStartProgress {
  const next = { ...progress, [event.step]: event.status };
  if (event.status === "signing" && event.fee !== null) next.fee = event.fee;
  if (event.status === "done") next.hashes = { ...progress.hashes, [event.step]: event.hash };
  return next;
}

/** The start progress of one booking, by its ask (`claimActKey`); none before a start. */
interface KeyedProgress {
  key: string | null;
  progress: VoucherStartProgress;
}

const NOTHING_STARTED: KeyedProgress = { key: null, progress: VOUCHER_START_IDLE };

export function useVoucherStart(input: { chainId: number; garden: Address }): {
  start: (target: VoucherStartTarget) => Promise<VoucherStartOutcome>;
  /** Where this booking's start stands; idle for any booking but the one last started. */
  progressFor: (commitmentId: bigint, buyer: Address) => VoucherStartProgress;
  /** Forget the last start, so a new acceptance opens with nothing sent. */
  reset: () => void;
} {
  const { chainId, garden } = input;
  const sender = useTransactionSender();
  const steward = usePrimaryAddress();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState<KeyedProgress>(NOTHING_STARTED);

  const start = useCallback(
    async (target: VoucherStartTarget): Promise<VoucherStartOutcome> => {
      const key = claimActKey(target.commitmentId, target.buyer);
      // Each update lands only on the booking it was sent for.
      const setProgress = (update: (current: VoucherStartProgress) => VoucherStartProgress) =>
        setStarted((current) =>
          current.key === key ? { key, progress: update(current.progress) } : current
        );
      setStarted({ key, progress: VOUCHER_START_IDLE });
      if (!sender || !steward) return "notSent";
      const outcome = await runVoucherStart({
        prepare: () => prepareVoucherStartSend({ chainId, garden }, target, steward),
        send: (call, step) =>
          recordSendAct(
            {
              act: "pool_service_access",
              operation:
                step === "record" ? "finalizeVoucherActivation" : "dispatchVoucherSetupCommand",
              authMode: sender.authMode,
              chainId,
            },
            () =>
              sender.sendContractCall(call, {
                onBroadcast: async () =>
                  setProgress((current) => ({ ...current, [step]: "confirming" })),
              })
          ),
        report: (event) => setProgress((current) => apply(current, event)),
      });
      // Whatever went, the queue and the booking's promise read the chain again.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: commitmentPoolingKeys.voucherConsole(chainId, garden),
        }),
        queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) }),
      ]);
      return outcome;
    },
    [chainId, garden, queryClient, sender, steward]
  );

  const progressFor = useCallback(
    (commitmentId: bigint, buyer: Address) =>
      started.key === claimActKey(commitmentId, buyer) ? started.progress : VOUCHER_START_IDLE,
    [started]
  );
  const reset = useCallback(() => setStarted(NOTHING_STARTED), []);
  return { start, progressFor, reset };
}
