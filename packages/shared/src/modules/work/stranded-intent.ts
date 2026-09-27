/**
 * Stranded send intents
 *
 * A send intent is recorded just before a send can reach the network. When
 * its answer is lost (a wallet that never replied, a UserOperation no bundler
 * reports), or its reference is one no receipt answers (a Safe's own
 * transaction id), no receipt can settle it and the job would wait forever.
 * What the chain recorded settles it instead, through a lookup the executor
 * supplies: the person's own attestations for work and decisions, and the
 * pool's event log and the module's own records for a commitment act.
 *
 * A landing completes the job. An intent still absent well after the send
 * reopens it. A transaction on record reopens only once it can never be
 * included: the wallet saw it replaced, or another transaction took its nonce,
 * which a Safe's id never shows. Nothing reopens while a tab, the account or
 * the bundler may still send it.
 *
 * @module modules/work/stranded-intent
 */

import type { Hex } from "viem";
import type { Address, WorkApprovalDraft } from "../../types/domain";
import type {
  ApprovalJobPayload,
  Job,
  SendCheckpoint,
  WorkJobPayload,
} from "../../types/job-queue";
import { logger } from "../app/logger";
import { jobQueueDB } from "../job-queue/db";
import { writeSendCheckpoint } from "../job-queue/queue-policy";
import { buildQueuedApprovalDraft } from "./queued-work-draft";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  retainedTransactionReplaced,
} from "./work-confirmation";

/** How long a send may go unfound on-chain before its job is offered to send again. */
export const STRANDED_INTENT_GRACE_MS = 30 * 60_000;
/** The indexer trails the chain, so a younger send is not looked up yet. */
const LOOKUP_AFTER_MS = 2 * 60_000;
/** One job is looked up at most this often. */
const LOOKUP_INTERVAL_MS = 5 * 60_000;
/** Device clocks drift, so the lookup reaches back this far before the recorded send. */
const CLOCK_DRIFT_MS = 24 * 60 * 60_000;

type LookupResult = { status: "found"; transactionHash: Hex } | { status: "absent" | "unknown" };
export type StrandedLookupResult = LookupResult;

/** Where a lookup reads from, and when the send's intent was recorded, on the device's clock. */
interface LookupWindow {
  sinceMs: number;
  sentAtMs: number;
  /** The chain's time at the intent, in seconds, when the send kept it. */
  intentChainTime?: number;
}

export type StrandedWorkLookup = (
  input: {
    clientWorkId: string;
    chainId: number;
    garden: Address;
    caller: Address;
  } & LookupWindow
) => Promise<LookupResult>;

export type StrandedDecisionLookup = (
  input: {
    /** The decision as its send encodes it. */
    decision: WorkApprovalDraft;
    chainId: number;
    steward: Address;
  } & LookupWindow
) => Promise<LookupResult>;

export interface StrandedIntentDependencies<Lookup, Payload> {
  now: () => number;
  lookUp: Lookup;
  persist: (job: Job<Payload>) => Promise<void>;
  /** Whether a tab, the account or the bundler may still send it: nothing reopens while one may. */
  stillSending: () => Promise<boolean>;
  /**
   * Whether its transaction can never be included because another took its
   * nonce. Without it, a transaction on record reopens only when the wallet
   * saw it replaced.
   */
  transactionSuperseded: () => Promise<boolean>;
}

/** A lookup is always supplied; the clock, the store and the guards may be. */
export type StrandedSendDependencies<Lookup, Payload> = Partial<
  Omit<StrandedIntentDependencies<Lookup, Payload>, "lookUp">
> & { lookUp: Lookup };

export type StrandedIntentResolution =
  | { status: "landed"; transactionHash: Hex }
  | { status: "waiting" }
  | { status: "reopened" };

/** The send never landed and its intent was cleared, so the job may be sent again. */
export class StrandedSendReopened extends Error {
  constructor() {
    super("send-intent-expired");
    this.name = "StrandedSendReopened";
  }
}

const lastLookupAt = new Map<string, number>();
const persistJob = (job: Job) => jobQueueDB.updateJob(job);

/**
 * Whether no receipt can settle this intent. A transaction hash never is:
 * it may be a Safe transaction still collecting signatures.
 */
export function isStrandedIntentCandidate(checkpoint?: SendCheckpoint): boolean {
  if (!checkpoint || checkpoint.transactionHash) return false;
  if (checkpoint.broadcast) return checkpoint.broadcast.kind === "user-operation";
  return checkpoint.broadcastPending === true;
}

/**
 * Settle an intent no receipt can: complete it when it landed, reopen it when
 * it is still absent well after the send, or keep waiting. Only an absence the
 * lookup confirms reopens a job.
 */
async function resolveStrandedSend(send: {
  jobId: string;
  createdAt: number;
  checkpoint: SendCheckpoint;
  now: number;
  lookUp: (window: LookupWindow) => Promise<LookupResult>;
  /** Clears the intent so the job may be sent again. Absent, nothing reopens the send. */
  reopen?: () => void;
  /** Whether the send may still land, so a wallet prompt or the network may yet send it. */
  stillSending?: () => Promise<boolean>;
  persist: () => Promise<void>;
}): Promise<StrandedIntentResolution> {
  const { checkpoint, jobId, now } = send;
  const recordedAt = Date.parse(checkpoint.broadcastPendingAt ?? "");
  if (!Number.isFinite(recordedAt)) {
    // An earlier build recorded no time, so the grace window starts now.
    checkpoint.broadcastPendingAt = new Date(now).toISOString();
    await send.persist();
    return { status: "waiting" };
  }
  const age = now - recordedAt;
  if (age < LOOKUP_AFTER_MS) return { status: "waiting" };
  if (now - (lastLookupAt.get(jobId) ?? Number.NEGATIVE_INFINITY) < LOOKUP_INTERVAL_MS)
    return { status: "waiting" };
  lastLookupAt.set(jobId, now);

  let lookup: LookupResult;
  try {
    lookup = await send.lookUp({
      sinceMs: Math.min(recordedAt, send.createdAt) - CLOCK_DRIFT_MS,
      sentAtMs: recordedAt,
      intentChainTime: checkpoint.intentChainTime,
    });
  } catch (error) {
    logger.warn("[StrandedIntent] Could not check whether a queued send landed", {
      jobId,
      error,
    });
    return { status: "waiting" };
  }
  if (lookup.status === "found") {
    lastLookupAt.delete(jobId);
    return { status: "landed", transactionHash: lookup.transactionHash };
  }
  if (lookup.status === "unknown" || age < STRANDED_INTENT_GRACE_MS) return { status: "waiting" };
  // A prompt still open in a tab the OS froze can send after any window.
  if (!send.reopen || (await send.stillSending?.())) return { status: "waiting" };

  // Still absent well after the send: nothing landed, so the job may be sent again.
  send.reopen();
  forgetWorkBroadcast(jobId);
  lastLookupAt.delete(jobId);
  await send.persist();
  return { status: "reopened" };
}

/**
 * Settle a job's send on record, whatever its kind. A transaction no receipt
 * answers, such as a Safe's own id, is looked up as well: its landing completes
 * the job. Its absence alone never reopens it, because the Safe may still be
 * collecting signatures: only proof it can never be included does, a
 * replacement the wallet saw or another transaction on its nonce.
 */
async function resolveRecordedSend<Payload>(input: {
  job: Job<Payload>;
  checkpoint: SendCheckpoint | undefined;
  lookUp: (window: LookupWindow) => Promise<LookupResult>;
  reopen: () => void;
  deps: Omit<StrandedSendDependencies<unknown, Payload>, "lookUp">;
}): Promise<StrandedIntentResolution> {
  const { job, checkpoint, deps } = input;
  const persist = deps.persist ?? persistJob;
  if (checkpoint && !checkpoint.transactionReplaced && retainedTransactionReplaced(job.id)) {
    // Storage refused the mark when the wallet saw the replacement: write it
    // again, and read it from memory until it lands.
    checkpoint.transactionReplaced = true;
    try {
      await persist(job);
    } catch (error) {
      logger.warn("[StrandedIntent] Could not write a replaced transaction's mark", {
        jobId: job.id,
        error,
      });
    }
  }
  const replaced = checkpoint?.transactionReplaced === true;
  const onRecord = Boolean(checkpoint?.transactionHash) && !replaced;
  const superseded = deps.transactionSuperseded;
  const reopenable =
    isStrandedIntentCandidate(checkpoint) || replaced || (onRecord && superseded !== undefined);
  if (!checkpoint || (!reopenable && !checkpoint.transactionHash)) return { status: "waiting" };
  return resolveStrandedSend({
    jobId: job.id,
    createdAt: job.createdAt,
    checkpoint,
    now: deps.now?.() ?? Date.now(),
    lookUp: input.lookUp,
    reopen: reopenable ? input.reopen : undefined,
    // A transaction on record may still land until another takes its nonce.
    stillSending: async () =>
      Boolean(await deps.stillSending?.()) || (onRecord && !(await superseded?.())),
    persist: () => persist(job),
  });
}

export async function resolveStrandedWorkIntent(
  job: Job<WorkJobPayload>,
  chainId: number,
  deps: StrandedSendDependencies<StrandedWorkLookup, WorkJobPayload>
): Promise<StrandedIntentResolution> {
  const clientWorkId = job.payload.clientWorkId;
  if (!clientWorkId) return { status: "waiting" };
  return resolveRecordedSend({
    job,
    checkpoint: job.payload.uploadCheckpoint,
    lookUp: (window) =>
      deps.lookUp({
        clientWorkId,
        chainId,
        garden: job.payload.gardenAddress as Address,
        caller: job.userAddress as Address,
        ...window,
      }),
    // Work waits for the person's Send, so a reopened send never prompts on its
    // own. Its uploads stay: sending again only needs a new call.
    reopen: () => {
      writeSendCheckpoint(job, undefined);
      job.meta = { ...job.meta, requiresExplicitSend: true };
    },
    deps,
  });
}

export async function resolveStrandedDecisionIntent(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  deps: StrandedSendDependencies<StrandedDecisionLookup, ApprovalJobPayload>
): Promise<StrandedIntentResolution> {
  return resolveRecordedSend({
    job,
    checkpoint: job.payload.sendCheckpoint,
    lookUp: (window) =>
      deps.lookUp({
        decision: buildQueuedApprovalDraft(job.payload),
        chainId,
        steward: job.userAddress as Address,
        ...window,
      }),
    // A reopened decision goes back to waiting for Upload all, which is the
    // only thing that sends it, so it needs no flag of its own.
    reopen: () => {
      delete job.payload.sendCheckpoint;
    },
    deps,
  });
}

/** Whether a commitment act's lost send reached the chain after `sinceMs`. */
export type StrandedCommitmentLookup = (input: {
  job: Job;
  chainId: number;
  sinceMs: number;
}) => Promise<LookupResult>;

type CommitmentPayloadWithRecord = { sendCheckpoint?: SendCheckpoint };

export async function resolveStrandedCommitmentIntent(
  job: Job,
  chainId: number,
  deps: StrandedSendDependencies<StrandedCommitmentLookup, unknown>
): Promise<StrandedIntentResolution> {
  const payload = job.payload as CommitmentPayloadWithRecord;
  return resolveRecordedSend({
    job,
    checkpoint: payload.sendCheckpoint,
    lookUp: ({ sinceMs }) => deps.lookUp({ job, chainId, sinceMs }),
    // A reopened act waits for the person's Send Now: the commitment may have
    // moved on while its send was lost, so nothing sends it on its own.
    reopen: () => {
      delete payload.sendCheckpoint;
      job.meta = { ...job.meta, requiresExplicitSend: true };
    },
    deps,
  });
}

async function settle(
  resolution: Promise<StrandedIntentResolution>,
  pendingHash: Hex
): Promise<Hex> {
  const settled = await resolution;
  if (settled.status === "landed") return settled.transactionHash;
  if (settled.status === "reopened") throw new StrandedSendReopened();
  throw new AwaitingWorkConfirmation(pendingHash);
}

/** For the executor: the transaction that landed, or a waiting or reopened error. */
export function settleStrandedWorkIntent(
  job: Job<WorkJobPayload>,
  chainId: number,
  pendingHash: Hex,
  deps: StrandedSendDependencies<StrandedWorkLookup, WorkJobPayload>
): Promise<Hex> {
  return settle(resolveStrandedWorkIntent(job, chainId, deps), pendingHash);
}

/** For the approval executor: the transaction that landed, or a waiting or reopened error. */
export function settleStrandedDecisionIntent(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  pendingHash: Hex,
  deps: StrandedSendDependencies<StrandedDecisionLookup, ApprovalJobPayload>
): Promise<Hex> {
  return settle(resolveStrandedDecisionIntent(job, chainId, deps), pendingHash);
}

/** For the commitment executor: the transaction that landed, or a waiting or reopened error. */
export function settleStrandedCommitmentIntent(
  job: Job,
  chainId: number,
  pendingHash: Hex,
  deps: StrandedSendDependencies<StrandedCommitmentLookup, unknown>
): Promise<Hex> {
  return settle(resolveStrandedCommitmentIntent(job, chainId, deps), pendingHash);
}
