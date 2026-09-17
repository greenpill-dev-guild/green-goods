/**
 * Stranded send intents
 *
 * A send intent is recorded just before a send can reach the network. When
 * its answer is lost (a wallet that never replied, a UserOperation no bundler
 * reports), no receipt can settle it and the job would wait forever. The
 * person's own attestations can settle it: landed work carries its client work
 * id in its metadata, and a landed decision names the work it decides.
 *
 * @module modules/work/stranded-intent
 */

import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type {
  ApprovalJobPayload,
  Job,
  SendCheckpoint,
  WorkJobPayload,
} from "../../types/job-queue";
import { logger } from "../app/logger";
import { resolveDeferredWorkIdentity } from "../commitment-pooling/work-identity";
import { getWorkDecisionsSince, getWorkSubmissionsSince } from "../data/eas-sent-attestations";
import { jobQueueDB } from "../job-queue/db";
import { AwaitingWorkConfirmation, forgetWorkBroadcast } from "./work-confirmation";

/** How long a send may go unfound on-chain before its job is offered to send again. */
export const STRANDED_INTENT_GRACE_MS = 30 * 60_000;
/** The indexer trails the chain, so a younger send is not looked up yet. */
const LOOKUP_AFTER_MS = 2 * 60_000;
/** One job is looked up at most this often. */
const LOOKUP_INTERVAL_MS = 5 * 60_000;
/** Device clocks drift, so the lookup reaches back this far before the recorded send. */
const CLOCK_DRIFT_MS = 24 * 60 * 60_000;

type LookupResult = { status: "found"; transactionHash: Hex } | { status: "absent" | "unknown" };

export type StrandedWorkLookup = (input: {
  clientWorkId: string;
  chainId: number;
  garden: Address;
  caller: Address;
  sinceMs: number;
}) => Promise<LookupResult>;

export type StrandedDecisionLookup = (input: {
  workUID: string;
  approved: boolean;
  chainId: number;
  steward: Address;
  sinceMs: number;
}) => Promise<LookupResult>;

export interface StrandedIntentDependencies<Lookup, Payload> {
  now: () => number;
  lookUp: Lookup;
  persist: (job: Job<Payload>) => Promise<void>;
}

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

const lookUpLandedWork: StrandedWorkLookup = async ({ sinceMs, ...input }) => {
  const transactionHashes = new Map<string, Hex | undefined>();
  const identity = await resolveDeferredWorkIdentity({
    ...input,
    dependencies: {
      getWorksByGardener: async () => {
        const submissions = await getWorkSubmissionsSince({
          attester: input.caller,
          garden: input.garden,
          chainId: input.chainId,
          sinceSeconds: sinceMs / 1000,
        });
        for (const { work, transactionHash } of submissions)
          transactionHashes.set(work.id.toLowerCase(), transactionHash);
        return submissions.map(({ work }) => work);
      },
    },
  });
  if (identity.status === "waiting") return { status: "absent" };
  // A failed metadata read or a duplicate identity proves nothing either way.
  if (identity.status !== "resolved") return { status: "unknown" };
  const transactionHash = transactionHashes.get(identity.workUID.toLowerCase());
  return transactionHash ? { status: "found", transactionHash } : { status: "unknown" };
};

const lookUpLandedDecision: StrandedDecisionLookup = async ({ sinceMs, steward, ...input }) => {
  const decisions = await getWorkDecisionsSince({
    attester: steward,
    workUID: input.workUID,
    chainId: input.chainId,
    sinceSeconds: sinceMs / 1000,
  });
  // The resolver accepts a repeated decision, so the same decision on the same
  // work from the same steward counts as this one: completing it beats sending twice.
  const landed = decisions.find(({ decision }) => decision.approved === input.approved);
  if (!landed) return { status: "absent" };
  return landed.transactionHash
    ? { status: "found", transactionHash: landed.transactionHash }
    : { status: "unknown" };
};

/**
 * Settle an intent no receipt can: complete it when its attestation landed,
 * reopen it when the attestation is still absent well after the send, or keep
 * waiting. Only an absence the indexer confirms reopens a job.
 */
async function resolveStrandedSend(send: {
  jobId: string;
  createdAt: number;
  checkpoint: SendCheckpoint;
  now: number;
  lookUp: (sinceMs: number) => Promise<LookupResult>;
  /** Clears the intent so the job may be sent again. */
  reopen: () => void;
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
    lookup = await send.lookUp(Math.min(recordedAt, send.createdAt) - CLOCK_DRIFT_MS);
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

  // Still absent well after the send: nothing landed, so the job may be sent again.
  send.reopen();
  forgetWorkBroadcast(jobId);
  lastLookupAt.delete(jobId);
  await send.persist();
  return { status: "reopened" };
}

export async function resolveStrandedWorkIntent(
  job: Job<WorkJobPayload>,
  chainId: number,
  deps: Partial<StrandedIntentDependencies<StrandedWorkLookup, WorkJobPayload>> = {}
): Promise<StrandedIntentResolution> {
  const checkpoint = job.payload.uploadCheckpoint;
  const clientWorkId = job.payload.clientWorkId;
  if (!checkpoint || !clientWorkId || !isStrandedIntentCandidate(checkpoint))
    return { status: "waiting" };
  const persist = deps.persist ?? persistJob;
  return resolveStrandedSend({
    jobId: job.id,
    createdAt: job.createdAt,
    checkpoint,
    now: deps.now?.() ?? Date.now(),
    lookUp: (sinceMs) =>
      (deps.lookUp ?? lookUpLandedWork)({
        clientWorkId,
        chainId,
        garden: job.payload.gardenAddress as Address,
        caller: job.userAddress as Address,
        sinceMs,
      }),
    // Work waits for the person's Send, so a reopened send never prompts on its own.
    reopen: () => {
      delete checkpoint.broadcastPending;
      delete checkpoint.broadcastPendingAt;
      delete checkpoint.broadcast;
      job.meta = { ...job.meta, requiresExplicitSend: true };
    },
    persist: () => persist(job),
  });
}

export async function resolveStrandedDecisionIntent(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  deps: Partial<StrandedIntentDependencies<StrandedDecisionLookup, ApprovalJobPayload>> = {}
): Promise<StrandedIntentResolution> {
  const checkpoint = job.payload.sendCheckpoint;
  if (!checkpoint || !isStrandedIntentCandidate(checkpoint)) return { status: "waiting" };
  const persist = deps.persist ?? persistJob;
  return resolveStrandedSend({
    jobId: job.id,
    createdAt: job.createdAt,
    checkpoint,
    now: deps.now?.() ?? Date.now(),
    lookUp: (sinceMs) =>
      (deps.lookUp ?? lookUpLandedDecision)({
        workUID: job.payload.workUID,
        approved: job.payload.approved,
        chainId,
        steward: job.userAddress as Address,
        sinceMs,
      }),
    // Decisions have no send control of their own yet, so a reopened one is
    // sent again by the next pass rather than held for a tap.
    reopen: () => {
      delete job.payload.sendCheckpoint;
    },
    persist: () => persist(job),
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
  pendingHash: Hex = "0x",
  deps: Partial<StrandedIntentDependencies<StrandedWorkLookup, WorkJobPayload>> = {}
): Promise<Hex> {
  return settle(resolveStrandedWorkIntent(job, chainId, deps), pendingHash);
}

/** For the approval executor: the transaction that landed, or a waiting or reopened error. */
export function settleStrandedDecisionIntent(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  pendingHash: Hex = "0x",
  deps: Partial<StrandedIntentDependencies<StrandedDecisionLookup, ApprovalJobPayload>> = {}
): Promise<Hex> {
  return settle(resolveStrandedDecisionIntent(job, chainId, deps), pendingHash);
}
