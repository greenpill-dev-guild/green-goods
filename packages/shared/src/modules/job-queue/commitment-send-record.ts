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
 * send it. A browser without Web Locks cannot say, so there it is never offered
 * again: it completes when the chain shows it landed. Nor is it offered again
 * while its account has a transaction the network holds but has not mined,
 * which may be the send itself if its answer was lost after the network took it,
 * nor while its bundler still holds a passkey send's UserOperation.
 *
 * A transaction on record is offered again only once it can never be included:
 * its account signs its own transactions, and another took its nonce. A Safe's
 * id never shows that, so such a send completes only when the act lands.
 *
 * @module modules/job-queue/commitment-send-record
 */

import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { Job, SendCheckpoint } from "../../types/job-queue";
import { logger } from "../app/logger";
import type { BroadcastReference, ContractCall, TransactionSender } from "../transactions/types";
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
 * When the locks cannot say, because the browser keeps none or the read
 * failed, the act keeps waiting rather than risk a second send.
 */
async function stillSending(jobId: string): Promise<boolean> {
  const locks = sendLocks();
  if (!locks) return true;
  try {
    const { held = [] } = await locks.query();
    return held.some((lock) => lock.name === SEND_LOCK_PREFIX + jobId);
  } catch (error) {
    logger.warn("[JobQueue] Could not read which tabs hold a commitment act's send", {
      jobId,
      error,
    });
    return true;
  }
}

/**
 * Whether the account has a transaction the network holds but has not mined.
 * When the chain cannot say, the act keeps waiting rather than risk a second send.
 */
async function accountStillSending(
  account: Address,
  chainReads: CommitmentChainReads
): Promise<boolean> {
  if (!chainReads.hasPendingTransaction) return true;
  try {
    return await chainReads.hasPendingTransaction(account);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a commitment act's account has a send waiting", {
      error,
    });
    return true;
  }
}

/**
 * Whether the bundler still holds this act's UserOperation, so it may yet land.
 * When the bundler cannot say, the act keeps waiting rather than risk a second send.
 */
async function operationStillQueued(
  reference: BroadcastReference | undefined,
  chainReads: CommitmentChainReads
): Promise<boolean> {
  if (reference?.kind !== "user-operation") return false;
  if (!chainReads.userOperationMayLand) return true;
  try {
    return await chainReads.userOperationMayLand(reference.hash);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a commitment act's UserOperation may land", {
      error,
    });
    return true;
  }
}

/**
 * Keep the nonce the act's transaction used, read off the transaction while the
 * network holds it. A transaction the network never showed keeps no nonce, and
 * then nothing can prove another took it: the act waits rather than risk a
 * second send.
 */
export async function observeTransactionNonce(
  job: Job,
  chainReads: CommitmentChainReads,
  store: Pick<CommitmentExecutorStore, "updateJob">
): Promise<void> {
  const checkpoint = sendCheckpointOf(job);
  const hash = checkpoint?.transactionHash;
  if (!checkpoint || !hash || checkpoint.transactionNonce?.hash === hash) return;
  if (!chainReads.readTransactionNonce) return;
  try {
    const nonce = await chainReads.readTransactionNonce(hash);
    if (nonce === null) return;
    writeSendCheckpoint(job, { ...checkpoint, transactionNonce: { hash, nonce } });
    await store.updateJob(job);
  } catch (error) {
    logger.warn("[JobQueue] Could not read the nonce a commitment act's transaction used", {
      error,
    });
  }
}

/**
 * Whether the act's transaction can never be included because another took its
 * nonce. Only the nonce read off this very transaction can show it; one read
 * for another hash, or a count read before the prompt, cannot. When the chain
 * cannot say, the act keeps waiting rather than risk a second send.
 */
async function transactionSuperseded(
  checkpoint: SendCheckpoint | undefined,
  account: Address,
  chainReads: CommitmentChainReads
): Promise<boolean> {
  const hash = checkpoint?.transactionHash;
  const used = checkpoint?.transactionNonce;
  if (!hash || used?.hash !== hash || !chainReads.transactionSuperseded) return false;
  try {
    return await chainReads.transactionSuperseded(hash, account, used.nonce);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a commitment act's transaction lost its nonce", {
      error,
    });
    return false;
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
  store: CommitmentExecutorStore,
  /** The chain's head just before the send, kept with its intent. */
  intent?: Pick<SendCheckpoint, "intentBlock" | "intentChainTime">
): Promise<Hex> {
  const result = await holdingSend(jobId, () =>
    sendWithCheckpoint({
      sender,
      call,
      jobIds: [jobId],
      record: async (next) => {
        const send = next(sendCheckpointOf(job) ?? {});
        writeSendCheckpoint(job, send && intent ? { ...send, ...intent } : send);
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
      // Nothing reached the chain. A person who declined is not asked again
      // until they send it themselves: a background flush passes the act by.
      if (result.cancelled) {
        job.meta = { ...job.meta, requiresExplicitSend: true };
        await store.updateJob(job);
      }
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
 * receipt answers completes when the act lands, and is offered again only once
 * another took its nonce, which a Safe's own id never shows.
 */
export async function settleActSend(
  jobId: string,
  job: Job,
  chainId: number,
  sender: TransactionSender,
  store: CommitmentExecutorStore,
  chainReads: CommitmentChainReads,
  deps: Pick<
    CommitmentQueueExecutorDeps,
    "reconcile" | "settleStrandedIntent" | "lookUpLanded" | "resolveWorkIdentity"
  >
): Promise<CommitmentQueueExecution> {
  const settleStranded =
    deps.settleStrandedIntent ??
    (async (stranded: Job, strandedChain: number, pendingHash: Hex) => {
      // Each pass while the network holds the transaction may keep its nonce.
      await observeTransactionNonce(stranded, chainReads, store);
      return settleStrandedCommitmentIntent(stranded, strandedChain, pendingHash, {
        lookUp:
          deps.lookUpLanded ??
          createCommitmentLandedLookup({
            readWorkLinkPayloadHash: chainReads.readWorkLinkPayloadHash,
            transactionMadeWorkLink: chainReads.transactionMadeWorkLink,
            transactionMadeClaim: chainReads.transactionMadeClaim,
            resolveWorkIdentity: deps.resolveWorkIdentity,
          }),
        stillSending: async () =>
          (await stillSending(jobId)) ||
          (await accountStillSending(stranded.userAddress as Address, chainReads)) ||
          (await operationStillQueued(sendCheckpointOf(stranded)?.broadcast, chainReads)),
        transactionSuperseded: () =>
          transactionSuperseded(
            sendCheckpointOf(stranded),
            stranded.userAddress as Address,
            chainReads
          ),
        persist: (updated) => store.updateJob(updated),
      });
    });
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
