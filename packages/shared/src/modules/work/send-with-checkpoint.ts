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
import { logger } from "../app/logger";
import {
  type BroadcastReference,
  type ContractCall,
  TransactionReplacementError,
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";
import { intentHead } from "../job-queue/send-chain-reads";
import { classifySendFailure } from "./send-outcome";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  reconcileWorkTransaction,
  rememberTransactionReplaced,
  rememberWorkBroadcast,
  retainedWorkBroadcastReference,
} from "./work-confirmation";

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
  /**
   * The chain's head. The send keeps it with its intent, read at the last point
   * before the send can reach the network, and reads the time again if the
   * answer is lost, since the send may have gone out at any point until then.
   */
  readChainHead?: () => Promise<{ number: bigint; timestamp: number }>;
  /** A head read before the send, kept when the one at the intent cannot be read. */
  headBeforeSend?: Pick<SendCheckpoint, "intentBlock" | "intentChainTime">;
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

/**
 * A lost send's record with its window restarted at `lostAt`. A wallet asks
 * only after the intent is recorded, and its prompt can stay open past the
 * whole window, so a lost answer means the send may have gone out at any point
 * until then. The window counts from the chain's time when the answer was
 * lost, or, when the chain could not say, from the intent's by how long the
 * send took. The intent's block and time stay: nothing the send did can land
 * before them.
 */
export function restartedWindow<T extends SendCheckpoint>(
  current: T,
  lostAt: number,
  lost: Pick<SendCheckpoint, "intentChainTime"> | undefined
): T {
  if (!current.broadcastPending) return current;
  const recordedAt = Date.parse(current.broadcastPendingAt ?? "");
  const tookS = Number.isFinite(recordedAt) ? Math.max(0, (lostAt - recordedAt) / 1000) : 0;
  const windowChainTime =
    lost?.intentChainTime ??
    (current.intentChainTime === undefined ? undefined : current.intentChainTime + tookS);
  return {
    ...current,
    broadcastPendingAt: new Date(lostAt).toISOString(),
    ...(windowChainTime === undefined ? {} : { windowChainTime }),
  };
}

export async function sendWithCheckpoint({
  sender,
  call,
  jobIds,
  record,
  readChainHead,
  headBeforeSend,
  assertOwnership,
  now = Date.now,
}: CheckpointedSend): Promise<CheckpointedSendResult> {
  let intentAttempted = false;
  let intentRecorded = false;
  let broadcastKnown = false;
  let transactionRecorded = false;
  let carriedByOperation = false;
  // The chain's head is read once, at the last point before the send can reach
  // the network: after a passkey's prompt, so a prompt left open never ages it.
  // Every record carries it, even the hash a sender only returns.
  let head: Pick<SendCheckpoint, "intentBlock" | "intentChainTime"> | undefined;
  let headRead = false;
  const readHead = async () => {
    if (headRead) return;
    headRead = true;
    head = (await intentHead(readChainHead)) ?? headBeforeSend;
  };
  const restartWindow = async () => {
    const lostAt = now();
    const lost = await intentHead(readChainHead);
    try {
      await record((current) => restartedWindow(current, lostAt, lost));
    } catch (error) {
      logger.warn("[SendCheckpoint] Could not restart a lost send's window", { jobIds, error });
    }
  };
  const write: RecordSend = (next) =>
    record((current) => {
      const send = next(current);
      return send && head ? { ...send, ...head } : send;
    });

  // Every reference is kept in memory before it is written, so a failed write
  // never turns a retry into a second send.
  const onBroadcastReference = async (reference: BroadcastReference) => {
    broadcastKnown = true;
    carriedByOperation ||= reference.kind === "user-operation";
    transactionRecorded ||= reference.kind === "transaction";
    for (const id of jobIds) rememberWorkBroadcast(id, reference);
    await write((current) => ({
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
    await write((current) => ({ ...current, transactionHash: hash, broadcastPending: false }));
  };

  try {
    const result = await sender.sendContractCall(call, {
      ...(assertOwnership ? { assertOwnership } : {}),
      onBeforeBroadcast: async (reference) => {
        await assertOwnership?.();
        carriedByOperation ||= reference?.kind === "user-operation";
        await readHead();
        const at = new Date(now()).toISOString();
        intentAttempted = true;
        await write(() => ({
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
    if (!transactionRecorded) {
      await readHead();
      await onBroadcast(result.hash);
    }
    return { status: "sent", hash: result.hash, confirmation: result.confirmation };
  } catch (error) {
    if (error instanceof TransactionRevertedError) return { status: "reverted", error };
    if (error instanceof TransactionReplacementError && error.code === "transaction_cancelled") {
      // The wallet confirmed replacement by a cancellation transaction. The
      // original call cannot be included, so its checkpoint may be retried.
      await write(() => undefined);
      for (const id of jobIds) forgetWorkBroadcast(id);
      return { status: "not-sent", cancelled: true, error };
    }
    if (error instanceof TransactionReplacementError && error.code === "transaction_replaced") {
      // Another call took this transaction's place, so it can never be
      // included. Whether that call did the same thing is unknown until the
      // caller inspects what landed, so the record stays and says so. The mark
      // is remembered first: storage that refuses it only loses it on reload.
      for (const id of jobIds) rememberTransactionReplaced(id);
      try {
        await write((current) => ({ ...current, transactionReplaced: true }));
      } catch (markError) {
        logger.warn("[SendCheckpoint] Could not mark a replaced transaction", {
          jobIds,
          error: markError,
        });
      }
      return { status: "may-have-sent", error };
    }
    const failure = classifySendFailure(error, { intentRecorded, broadcastKnown });
    if (failure.kind === "may-have-sent") {
      // Its answer was lost, so the send may have gone out at any point until now.
      if (!broadcastKnown) await restartWindow();
      return { status: "may-have-sent", error };
    }
    // Cleared even when the intent only half landed: a call that carries several
    // jobs may have written some of them before one write failed.
    if (intentAttempted) await write(() => undefined);
    for (const id of jobIds) forgetWorkBroadcast(id);
    return { status: "not-sent", cancelled: failure.cancelled, error };
  }
}

/**
 * Settle a send already on record instead of sending it again: a transaction by
 * its receipt, a UserOperation through the sender's own reconcile, and an
 * intent no receipt can answer through the caller's `settleStranded`. A revert
 * clears the record through `clear`, so the call may be sent again; a send
 * still on its way throws `AwaitingWorkConfirmation`. A transaction no receipt
 * answers is waited on, unless the caller settles it by `settleUnanswered`.
 */
export async function settleRecordedSend(input: {
  jobId: string;
  checkpoint: SendCheckpoint | undefined;
  chainId: number;
  sender: TransactionSender;
  reconcile?: typeof reconcileWorkTransaction;
  /** Removes the record from the job and persists it. */
  clear: () => Promise<void>;
  /** The transaction that landed, or a waiting or reopened error. */
  settleStranded: (pendingHash: Hex) => Promise<Hex>;
  /**
   * The transaction that landed, for a transaction no receipt answers (a
   * Safe's own id never produces one), or a waiting error. Absence alone must
   * never reopen the send, since the Safe may still be collecting signatures:
   * only proof the transaction can never be included may.
   */
  settleUnanswered?: (transactionHash: Hex) => Promise<Hex>;
}): Promise<Hex> {
  const { checkpoint, jobId } = input;
  const broadcast = checkpoint?.broadcast ?? retainedWorkBroadcastReference(jobId);
  let transactionHash =
    checkpoint?.transactionHash ?? (broadcast?.kind === "transaction" ? broadcast.hash : undefined);
  let state: "confirmed" | "reverted" | "unresolved" = "unresolved";
  if (broadcast?.kind === "user-operation" && !transactionHash) {
    const result = await input.sender.reconcileBroadcast?.(broadcast);
    state = result?.status ?? "unresolved";
    if (result?.status === "confirmed") transactionHash = result.transactionHash;
  } else if (transactionHash) {
    state = await (input.reconcile ?? reconcileWorkTransaction)(transactionHash, input.chainId);
  }
  if (state === "confirmed") return transactionHash!;
  if (state === "reverted") {
    // Nothing was recorded on chain, so the call may be sent again.
    const revertedHash = transactionHash ?? broadcast?.hash ?? "0x";
    forgetWorkBroadcast(jobId);
    await input.clear();
    throw new TransactionRevertedError(revertedHash);
  }
  if (transactionHash) {
    // A transaction hash may be a Safe transaction still collecting signatures.
    if (!input.settleUnanswered) throw new AwaitingWorkConfirmation(transactionHash);
    return input.settleUnanswered(transactionHash);
  }
  return input.settleStranded(broadcast?.hash ?? "0x");
}
