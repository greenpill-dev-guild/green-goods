/**
 * Add and Send in one signature (decision 20)
 *
 * Add and Send queues two acts: the proof (`attachEvidence`) and, behind it,
 * the send for confirmation (`submitForConfirmation`). The send reverts
 * `EvidenceRequired` until the proof is on chain, so they used to go one after
 * the other, two signatures. Where the rail is listed, a passkey or a wallet
 * that runs several calls as one transaction sends them as one request
 * instead, the proof first: both land or neither does. A plain wallet keeps
 * the two signatures.
 *
 * Each act stays its own job, with its claim, its send record and its recovery
 * read; the queue sends the two through one bundling sender
 * (`processTogether`). If the request fails, nothing of it lands and both stay
 * queued on the device, so a failed send never costs the proof. The tap, Send
 * Now on either half, and the background flush all pair them the same way.
 *
 * @module modules/commitment-pooling/proof-and-send
 */

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import type {
  FlushContext,
  JobQueueHandle,
  ProcessJobContext,
  ProcessJobResult,
} from "../job-queue/ports";
import { type BatchRail, isBatchEnabled } from "../transactions/batch-enablement";
import type { BatchBudget } from "../transactions/batch-types";
import type { TransactionSender } from "../transactions/types";
import { commitmentJobPrerequisite } from "./job-identity";
import type { EvidenceJobPayload } from "./job-types";

const ARBITRUM_CEILINGS = {
  maxCalls: 2,
  maxCalldataBytes: 4_096,
  maxFeePerGas: "1000000000",
  maxFee: "3000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for. On a fork of Arbitrum
 * (block 517,040,012), a live proof and its send ran as one batch from the account that sent
 * them for 158,572 gas, the proof alone for 115,568; the pair's calls take 836 bytes, and each
 * further credited contributor adds 32. A Green Goods passkey UserOperation adds about 730k. The
 * first live batch on each rail confirms them before that rail is listed.
 */
const PROOF_AND_SEND_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "3000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "1500000", sponsorship: "wallet" },
  },
};

/**
 * The ceilings a proof and its send go out under as one request from this
 * sender, or null when they go one after the other. A passkey answers from the
 * enablement list itself; a wallet must be listed here and able to run the
 * calls as one transaction. Asking never prompts anyone.
 */
export async function proofAndSendBudget(
  sender: TransactionSender | null,
  chainId: number
): Promise<BatchBudget | null> {
  if (!sender?.sendAtomicBatch || !sender.canSendAtomicBatch) return null;
  const rail: BatchRail | null =
    sender.authMode === "passkey" ? "passkey" : sender.authMode === "wallet" ? "wallet" : null;
  const budget = rail ? (PROOF_AND_SEND_BUDGETS[chainId]?.[rail] ?? null) : null;
  if (!rail || !budget) return null;
  if (
    rail === "wallet" &&
    !isBatchEnabled({ action: "proof-and-send", rail, profile: "eip-5792", chainId })
  )
    return null;
  const able = await sender.canSendAtomicBatch(chainId, "proof-and-send").catch(() => false);
  return able ? budget : null;
}

/** Whether `follower` is the send queued behind the proof `lead`. */
function isSendBehindProof(
  lead: Pick<Job, "id" | "kind">,
  follower: Pick<Job, "kind" | "payload">
): boolean {
  return (
    lead.kind === "evidence" &&
    follower.kind === "confirmation" &&
    commitmentJobPrerequisite(follower.kind, follower.payload) === lead.id
  );
}

/**
 * The proof and the send of one Add and Send, when `jobId` is either and both
 * still wait in the queue.
 */
export function proofAndSendPair(
  jobs: readonly Job[],
  jobId: string
): { proof: Job; send: Job } | null {
  const waiting = jobs.filter((job) => !job.synced);
  const self = waiting.find((job) => job.id === jobId);
  if (!self) return null;
  const send =
    self.kind === "evidence" ? waiting.find((job) => isSendBehindProof(self, job)) : self;
  const proof = send && waiting.find((job) => isSendBehindProof(job, send));
  return proof && send ? { proof, send } : null;
}

/** The background flush's pairing (`FlushContext.sendsWith`): only a proof and its send. */
export function sendsWithProof(
  sender: TransactionSender | null
): NonNullable<FlushContext["sendsWith"]> {
  return (lead, follower) =>
    isSendBehindProof(lead, follower)
      ? proofAndSendBudget(sender, lead.chainId || DEFAULT_CHAIN_ID)
      : Promise.resolve(null);
}

/**
 * Send Now on either half of an Add and Send, where the rail sends both as one
 * request: both get a fresh run and go together, and the result is the one of
 * the half the person pressed. Null when the act goes on its own.
 */
export async function sendWithItsPartner(
  queue: Pick<JobQueueHandle, "getJobs" | "retryJob" | "processTogether">,
  input: { owner: string; jobId: string; context: ProcessJobContext }
): Promise<ProcessJobResult | null> {
  const { owner, jobId, context } = input;
  const pair = proofAndSendPair(await queue.getJobs(owner), jobId);
  const budget = pair
    ? await proofAndSendBudget(context.transactionSender, pair.proof.chainId || DEFAULT_CHAIN_ID)
    : null;
  if (!pair || !budget) return null;
  await queue.retryJob(pair.proof.id);
  await queue.retryJob(pair.send.id);
  const sent = await queue.processTogether(pair.proof.id, pair.send.id, context, budget);
  return jobId === pair.send.id ? sent.follower : sent.lead;
}

/**
 * Add and Send's second act, queued behind the proof it goes after: two calls,
 * which a listed passkey or atomic wallet sends as one request and anyone else
 * with two signatures. Queued now rather than once the proof lands, so the send
 * is kept whatever happens to the screen: an offline add, a reload, a try the
 * queue repeats. The queue refuses a second, different send for the same
 * promise, so a send already queued there stands and this one is left out.
 *
 * Any other refusal takes the proof back out of the queue and rejects, so Add
 * and Send never quietly becomes Add: the form stays with its draft. Only a
 * proof already on its way, which can't be taken back, goes on alone, and the
 * promise then offers the send.
 */
export async function queueSendAfterProof(
  queue: Pick<JobQueueHandle, "addJob" | "discardJob">,
  input: { proof: EvidenceJobPayload; proofJobId: string; owner: Address; chainId: number }
): Promise<string | undefined> {
  const { proof, proofJobId, owner, chainId } = input;
  try {
    return await queue.addJob(
      "confirmation",
      {
        action: "submit",
        commitmentId: proof.commitmentId,
        gardenAddress: proof.gardenAddress,
        afterEvidenceJobId: proofJobId,
      },
      owner,
      { chainId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("offline_job_identity_conflict:")) return undefined;
    if (await queue.discardJob(proofJobId).catch(() => false)) throw error;
    logger.warn("[proof-and-send] Add and Send's send was not queued; the proof goes alone", {
      error: message,
    });
    return undefined;
  }
}
