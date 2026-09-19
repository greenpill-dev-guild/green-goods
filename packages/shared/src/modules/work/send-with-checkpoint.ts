/**
 * Sending one call while recording how far it got
 *
 * A queued send must never go out twice. So the job records an intent just
 * before the call can reach the network, then the broadcast's reference, then
 * its transaction, and what a failure means depends on how far that got: before
 * the intent nothing was sent, and after it only a refusal proves nothing was.
 *
 * This is the one place that protocol lives. The work executor, the decision
 * executor and Upload all each bring their own `record`, and each decides what
 * a revert or a declined prompt means for its jobs. A new job kind that sends a
 * call joins by doing the same.
 *
 * @module modules/work/send-with-checkpoint
 */

import type { Hex } from "viem";
import type { SendCheckpoint } from "../../types/job-queue";
import {
  type BroadcastReference,
  type ContractCall,
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";
import { classifySendFailure } from "./send-outcome";
import { forgetWorkBroadcast, rememberWorkBroadcast } from "./work-confirmation";

/** Applies a change to the send record of every job the call carries, and persists it. */
export type RecordSend = (
  next: (current: SendCheckpoint) => SendCheckpoint | undefined
) => Promise<void>;

export interface CheckpointedSend {
  sender: TransactionSender;
  call: ContractCall;
  /** Every job this call carries: an acknowledged broadcast is remembered under each. */
  jobIds: readonly string[];
  /** Must reject when a write fails: nothing may be sent without its intent on record. */
  record: RecordSend;
  assertOwnership?: () => void | Promise<void>;
  now?: () => number;
}

export type CheckpointedSendResult =
  | { status: "sent"; hash: Hex; confirmation?: TxResult["confirmation"] }
  /** Mined and reverted. The record is left alone: what a revert means is the caller's call. */
  | { status: "reverted"; error: TransactionRevertedError }
  /** Nothing reached the network, and the intent is cleared so the job may be sent again. */
  | { status: "not-sent"; cancelled: boolean; error: unknown }
  /** The answer was lost. The record is kept, so the send is confirmed and never repeated. */
  | { status: "may-have-sent"; error: unknown };

export async function sendWithCheckpoint({
  sender,
  call,
  jobIds,
  record,
  assertOwnership,
  now = Date.now,
}: CheckpointedSend): Promise<CheckpointedSendResult> {
  let intentAttempted = false;
  let intentRecorded = false;
  let broadcastKnown = false;
  let transactionRecorded = false;
  let carriedByOperation = false;

  // Every reference is kept in memory before it is written, so a failed write
  // never turns a retry into a second send.
  const onBroadcastReference = async (reference: BroadcastReference) => {
    broadcastKnown = true;
    carriedByOperation ||= reference.kind === "user-operation";
    transactionRecorded ||= reference.kind === "transaction";
    for (const id of jobIds) rememberWorkBroadcast(id, reference);
    await record((current) => ({
      ...current,
      broadcast: reference,
      broadcastPending: false,
      ...(reference.kind === "transaction" ? { transactionHash: reference.hash } : {}),
    }));
  };
  const onBroadcast = async (hash: Hex) => {
    // A UserOperation keeps its own reference; anything else is this transaction.
    if (!carriedByOperation) return onBroadcastReference({ kind: "transaction", hash });
    broadcastKnown = true;
    transactionRecorded = true;
    await record((current) => ({ ...current, transactionHash: hash, broadcastPending: false }));
  };

  try {
    const result = await sender.sendContractCall(call, {
      ...(assertOwnership ? { assertOwnership } : {}),
      onBeforeBroadcast: async (reference) => {
        await assertOwnership?.();
        carriedByOperation ||= reference?.kind === "user-operation";
        const at = new Date(now()).toISOString();
        intentAttempted = true;
        await record(() => ({
          broadcastPending: true,
          broadcastPendingAt: at,
          ...(reference ? { broadcast: reference } : {}),
        }));
        intentRecorded = true;
      },
      onBroadcastReference,
      onBroadcast,
    });
    // Older and custom senders only expose the hash on return.
    if (!transactionRecorded) await onBroadcast(result.hash);
    return { status: "sent", hash: result.hash, confirmation: result.confirmation };
  } catch (error) {
    if (error instanceof TransactionRevertedError) return { status: "reverted", error };
    const failure = classifySendFailure(error, { intentRecorded, broadcastKnown });
    if (failure.kind === "may-have-sent") return { status: "may-have-sent", error };
    // Cleared even when the intent only half landed: a call that carries several
    // jobs may have written some of them before one write failed.
    if (intentAttempted) await record(() => undefined);
    for (const id of jobIds) forgetWorkBroadcast(id);
    return { status: "not-sent", cancelled: failure.cancelled, error };
  }
}
