/**
 * The queue's send record, for commitment acts
 *
 * A take-up, a proof, a work link and a confirmation each send one call. Each
 * send is recorded the way work and decisions record theirs
 * (`send-with-checkpoint`): an intent before the call can reach the network,
 * then its reference and transaction. A later run settles what is on record
 * instead of sending it again, and Discard reads the same record, so an act
 * whose transaction may still land is neither dropped nor repeated.
 *
 * The record says a send may be out; the send's lock says whether a tab still
 * holds it. A tab the OS froze keeps its locks and a closed one gives them up,
 * so a lost send is offered again only once no tab's wallet prompt can still
 * send it.
 *
 * @module modules/job-queue/commitment-send-record
 */

import type { Hex } from "viem";
import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { sendWithCheckpoint, settleRecordedSend } from "../work/send-with-checkpoint";
import { settleStrandedCommitmentIntent, StrandedSendReopened } from "../work/stranded-intent";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  retainedWorkBroadcast,
} from "../work/work-confirmation";
import type { CommitmentChainReads } from "./commitment-chain-reads";
import { createCommitmentLandedLookup } from "./commitment-landed-lookup";
import type {
  CommitmentExecutorStore,
  CommitmentQueueExecution,
  CommitmentQueueExecutorDeps,
} from "./job-executors";
import { sendCheckpointOf, writeSendCheckpoint } from "./queue-policy";

/** Held from just before an act's send until its answer, per job and across tabs. */
const SEND_LOCK_PREFIX = "green-goods:queue-send:";

/** The origin's Web Locks, where the browser provides them. */
function sendLocks(): LockManager | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.locks;
}

/**
 * Run an act's send while holding its lock. A lock another tab holds means
 * that tab is mid-send, perhaps frozen with its prompt open, so the act is
 * left to it: the queue skips a job whose ownership changed.
 */
async function holdingSend<T>(jobId: string, send: () => Promise<T>): Promise<T> {
  const locks = sendLocks();
  if (!locks) return send();
  return locks.request(SEND_LOCK_PREFIX + jobId, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("submission-ownership-changed");
    return send();
  });
}

/**
 * Whether a tab still holds this act's send: its wallet prompt may yet send it.
 * When the locks cannot say, the act keeps waiting rather than risk a second send.
 */
async function stillSending(jobId: string): Promise<boolean> {
  try {
    const { held = [] } = (await sendLocks()?.query()) ?? {};
    return held.some((lock) => lock.name === SEND_LOCK_PREFIX + jobId);
  } catch (error) {
    logger.warn("[JobQueue] Could not read which tabs hold a commitment act's send", {
      jobId,
      error,
    });
    return true;
  }
}

/** A send on record waits for its confirmation; a reopened one waits for the person. */
export function waitingForRecordedSend(error: unknown): CommitmentQueueExecution | undefined {
  if (error instanceof AwaitingWorkConfirmation)
    return { status: "waiting", reason: "awaiting-confirmation" };
  if (error instanceof StrandedSendReopened)
    return { status: "waiting", reason: "send-intent-expired" };
  return undefined;
}

/** Drops an act's send record and the wait it caused, once a revert proves nothing landed. */
async function clearActSendRecord(job: Job, store: CommitmentExecutorStore): Promise<void> {
  writeSendCheckpoint(job, undefined);
  const { waitingReason: _waitingReason, ...meta } = job.meta ?? {};
  job.meta = { ...meta, waitingForDependency: false };
  await store.updateJob(job);
}

/**
 * Send one act through the queue's send record: an intent before the call can
 * reach the network, then its reference and transaction. The record goes on
 * the stored job, never the execution copy, so a reload keeps it and the act
 * is neither dropped nor sent twice while its answer is out.
 */
export async function sendRecordedAct(
  jobId: string,
  job: Job,
  call: ContractCall,
  sender: TransactionSender,
  store: CommitmentExecutorStore
): Promise<Hex> {
  const result = await holdingSend(jobId, () =>
    sendWithCheckpoint({
      sender,
      call,
      jobIds: [jobId],
      record: async (next) => {
        writeSendCheckpoint(job, next(sendCheckpointOf(job) ?? {}));
        await store.updateJob(job);
      },
    })
  );
  switch (result.status) {
    case "sent":
      if (result.confirmation === "pending") throw new AwaitingWorkConfirmation(result.hash);
      forgetWorkBroadcast(jobId);
      return result.hash;
    case "reverted":
      // Mined and reverted: nothing landed, so the act may be sent again.
      forgetWorkBroadcast(jobId);
      await clearActSendRecord(job, store);
      throw result.error;
    case "not-sent":
      throw result.error;
    case "may-have-sent":
      throw new AwaitingWorkConfirmation(
        retainedWorkBroadcast(jobId) ?? sendCheckpointOf(job)?.transactionHash ?? "0x"
      );
  }
}

/**
 * Settle an act whose send is on record instead of sending it again: by its
 * receipt, its UserOperation, or, when the answer was lost, by what the chain
 * recorded once the stranded-intent window has passed. A transaction no
 * receipt answers, such as a Safe's own id, completes when the act lands.
 */
export async function settleActSend(
  jobId: string,
  job: Job,
  chainId: number,
  sender: TransactionSender,
  store: CommitmentExecutorStore,
  chainReads: CommitmentChainReads,
  deps: Pick<CommitmentQueueExecutorDeps, "reconcile" | "settleStrandedIntent">
): Promise<CommitmentQueueExecution> {
  const settleStranded =
    deps.settleStrandedIntent ??
    ((stranded: Job, strandedChain: number, pendingHash: Hex) =>
      settleStrandedCommitmentIntent(stranded, strandedChain, pendingHash, {
        lookUp: createCommitmentLandedLookup({
          readWorkLinkPayloadHash: chainReads.readWorkLinkPayloadHash,
        }),
        stillSending: () => stillSending(jobId),
        persist: (updated) => store.updateJob(updated),
      }));
  try {
    const txHash = await settleRecordedSend({
      jobId,
      checkpoint: sendCheckpointOf(job),
      chainId,
      sender,
      reconcile: deps.reconcile,
      clear: () => clearActSendRecord(job, store),
      settleStranded: (pendingHash) => settleStranded(job, chainId, pendingHash),
      settleUnanswered: (transactionHash) => settleStranded(job, chainId, transactionHash),
    });
    forgetWorkBroadcast(jobId);
    return { status: "complete", txHash };
  } catch (error) {
    const waiting = waitingForRecordedSend(error);
    if (waiting) return waiting;
    throw error;
  }
}
