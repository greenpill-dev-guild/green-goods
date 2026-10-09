/**
 * The guards on a queued send's record
 *
 * A send is recorded before it can reach the network (`send-with-checkpoint`),
 * and a later run settles what is on record instead of sending it again. The
 * record says a send may be out; the send's lock says whether a tab still holds
 * it. A tab the OS froze keeps its locks and a closed one gives them up, so a
 * lost send is offered again only once no tab's wallet prompt can still send
 * it. A browser without Web Locks cannot say, so there a lost send is never
 * offered again: it completes when the chain shows it landed. Nor is it offered
 * again while its account has a transaction the network holds but has not
 * mined, which may be the send itself if its answer was lost after the network
 * took it, nor while its bundler still holds a passkey send's UserOperation.
 *
 * A transaction on record is offered again only once it can never be included:
 * its account signs its own transactions, and another took its nonce. A Safe's
 * id never shows that, so such a send completes only when it lands.
 *
 * Work, decisions, Upload all and commitment acts keep these same rules.
 *
 * @module modules/job-queue/send-guards
 */

import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import type { BroadcastReference } from "../transactions/types";
import { sendCheckpointOf, writeSendCheckpoint } from "./queue-policy";
import type { SendChainReads } from "./send-chain-reads";

/** Held from just before a send's intent until its answer, per job and across tabs. */
const SEND_LOCK_PREFIX = "green-goods:queue-send:";

/** The origin's Web Locks, where the browser provides them. */
function sendLocks(): LockManager | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.locks;
}

/**
 * Run one job's send while holding its lock. A lock another tab holds means
 * that tab is mid-send, perhaps frozen with its prompt open, so the job is left
 * to it: the queue skips a job whose ownership changed.
 */
export async function holdingSend<T>(jobId: string, send: () => Promise<T>): Promise<T> {
  const locks = sendLocks();
  if (!locks) return send();
  return locks.request(SEND_LOCK_PREFIX + jobId, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("submission-ownership-changed");
    return send();
  });
}

/**
 * Run one call carrying several jobs while holding the lock of each it can.
 * The send is given the jobs it holds; one another tab holds is left to that
 * tab. Without Web Locks, it is given them all.
 */
export async function holdingSends<T>(
  jobIds: readonly string[],
  send: (held: readonly string[]) => Promise<T>
): Promise<T> {
  const locks = sendLocks();
  if (!locks) return send(jobIds);
  const held: string[] = [];
  const hold = async (index: number): Promise<T> => {
    if (index === jobIds.length) return send(held);
    const jobId = jobIds[index];
    return locks.request(SEND_LOCK_PREFIX + jobId, { ifAvailable: true }, async (lock) => {
      if (lock) held.push(jobId);
      return hold(index + 1);
    });
  };
  return hold(0);
}

/**
 * Whether a tab still holds this job's send: its wallet prompt may yet send it.
 * When the locks cannot say, because the browser keeps none or the read
 * failed, the send keeps waiting rather than risk a second one.
 */
async function tabStillSending(jobId: string): Promise<boolean> {
  const locks = sendLocks();
  if (!locks) return true;
  try {
    const { held = [] } = await locks.query();
    return held.some((lock) => lock.name === SEND_LOCK_PREFIX + jobId);
  } catch (error) {
    logger.warn("[JobQueue] Could not read which tabs hold a queued send", { jobId, error });
    return true;
  }
}

/**
 * Whether the account has a transaction the network holds but has not mined.
 * When the chain cannot say, the send keeps waiting rather than risk a second one.
 */
async function accountStillSending(account: Address, reads: SendChainReads): Promise<boolean> {
  if (!reads.hasPendingTransaction) return true;
  try {
    return await reads.hasPendingTransaction(account);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a queued send's account has a send waiting", {
      error,
    });
    return true;
  }
}

/**
 * Whether the bundler still holds this send's UserOperation, so it may yet land.
 * When the bundler cannot say, the send keeps waiting rather than risk a second one.
 */
async function operationStillQueued(
  reference: BroadcastReference | undefined,
  reads: SendChainReads
): Promise<boolean> {
  if (reference?.kind !== "user-operation") return false;
  if (!reads.userOperationMayLand) return true;
  try {
    return await reads.userOperationMayLand(reference.hash);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a queued send's UserOperation may land", {
      error,
    });
    return true;
  }
}

/**
 * Whether a lost send may still land: a tab holds its send, its account has a
 * transaction waiting, or its bundler still holds its UserOperation.
 */
export async function sendMayStillLand(job: Job, reads: SendChainReads): Promise<boolean> {
  return (
    (await tabStillSending(job.id)) ||
    (await accountStillSending(job.userAddress as Address, reads)) ||
    (await operationStillQueued(sendCheckpointOf(job)?.broadcast, reads))
  );
}

/**
 * Keep the nonce the job's transaction used, read off the transaction while
 * the network holds it. A transaction the network never showed keeps no nonce,
 * and then nothing can prove another took it: the send waits rather than risk
 * a second one.
 */
export async function observeTransactionNonce(
  job: Job,
  reads: SendChainReads,
  store: { updateJob: (job: Job) => Promise<void> }
): Promise<void> {
  const checkpoint = sendCheckpointOf(job);
  const hash = checkpoint?.transactionHash;
  if (!checkpoint || !hash || checkpoint.transactionNonce?.hash === hash) return;
  if (!reads.readTransactionNonce) return;
  try {
    const nonce = await reads.readTransactionNonce(hash);
    if (nonce === null) return;
    writeSendCheckpoint(job, { ...checkpoint, transactionNonce: { hash, nonce } });
    await store.updateJob(job);
  } catch (error) {
    logger.warn("[JobQueue] Could not read the nonce a queued send's transaction used", { error });
  }
}

/**
 * Whether the job's transaction can never be included because another took its
 * nonce. Only the nonce read off this very transaction can show it; one read
 * for another hash, or a count read before the prompt, cannot. When the chain
 * cannot say, the send keeps waiting rather than risk a second one.
 */
export async function recordedTransactionSuperseded(
  job: Job,
  reads: SendChainReads
): Promise<boolean> {
  const checkpoint = sendCheckpointOf(job);
  const hash = checkpoint?.transactionHash;
  const used = checkpoint?.transactionNonce;
  if (!hash || used?.hash !== hash || !reads.transactionSuperseded) return false;
  try {
    return await reads.transactionSuperseded(hash, job.userAddress as Address, used.nonce);
  } catch (error) {
    logger.warn("[JobQueue] Could not read whether a queued send's transaction lost its nonce", {
      error,
    });
    return false;
  }
}
