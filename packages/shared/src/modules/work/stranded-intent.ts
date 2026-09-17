/**
 * Stranded send intents
 *
 * A send intent is recorded just before a send can reach the network. When
 * its answer is lost (a wallet that never replied, a UserOperation no bundler
 * reports), no receipt can settle it and the work would wait forever. The
 * gardener's own attestations can settle it: landed work carries its client
 * work id in its metadata.
 *
 * @module modules/work/stranded-intent
 */

import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/work-media";
import { logger } from "../app/logger";
import { resolveDeferredWorkIdentity } from "../commitment-pooling/work-identity";
import { getWorkSubmissionsSince } from "../data/eas-work-submissions";
import { jobQueueDB } from "../job-queue/db";
import { AwaitingWorkConfirmation, forgetWorkBroadcast } from "./work-confirmation";

/** How long a send may go unfound on-chain before its work is offered to send again. */
export const STRANDED_INTENT_GRACE_MS = 30 * 60_000;
/** The indexer trails the chain, so a younger send is not looked up yet. */
const LOOKUP_AFTER_MS = 2 * 60_000;
/** One job is looked up at most this often. */
const LOOKUP_INTERVAL_MS = 5 * 60_000;
/** Device clocks drift, so the lookup reaches back this far before the recorded send. */
const CLOCK_DRIFT_MS = 24 * 60 * 60_000;

export type StrandedWorkLookup = (input: {
  clientWorkId: string;
  chainId: number;
  garden: Address;
  caller: Address;
  sinceMs: number;
}) => Promise<{ status: "found"; transactionHash: Hex } | { status: "absent" | "unknown" }>;

export interface StrandedIntentDependencies {
  now: () => number;
  lookUp: StrandedWorkLookup;
  persist: (job: Job<WorkJobPayload>) => Promise<void>;
}

export type StrandedIntentResolution =
  | { status: "landed"; transactionHash: Hex }
  | { status: "waiting" }
  | { status: "reopened" };

/** The intent never landed and was cleared: the work waits for the person to send it. */
export class StrandedWorkIntentReopened extends Error {
  constructor() {
    super("send-intent-expired");
    this.name = "StrandedWorkIntentReopened";
  }
}

const lastLookupAt = new Map<string, number>();

/**
 * Whether no receipt can settle this intent. A transaction hash never is:
 * it may be a Safe transaction still collecting signatures.
 */
export function isStrandedIntentCandidate(checkpoint?: WorkUploadCheckpoint): boolean {
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

/**
 * Settle an intent no receipt can: complete it when its work landed, reopen it
 * when the work is still absent well after the send, or keep waiting. Only an
 * absence the indexer confirms reopens work; anything uncertain keeps waiting.
 */
export async function resolveStrandedWorkIntent(
  job: Job<WorkJobPayload>,
  chainId: number,
  deps: Partial<StrandedIntentDependencies> = {}
): Promise<StrandedIntentResolution> {
  const checkpoint = job.payload.uploadCheckpoint;
  const clientWorkId = job.payload.clientWorkId;
  if (!checkpoint || !clientWorkId || !isStrandedIntentCandidate(checkpoint))
    return { status: "waiting" };
  const now = deps.now?.() ?? Date.now();
  const persist = deps.persist ?? ((updated: Job<WorkJobPayload>) => jobQueueDB.updateJob(updated));

  const recordedAt = Date.parse(checkpoint.broadcastPendingAt ?? "");
  if (!Number.isFinite(recordedAt)) {
    // An earlier build recorded no time, so the grace window starts now.
    checkpoint.broadcastPendingAt = new Date(now).toISOString();
    await persist(job);
    return { status: "waiting" };
  }
  const age = now - recordedAt;
  if (age < LOOKUP_AFTER_MS) return { status: "waiting" };
  if (now - (lastLookupAt.get(job.id) ?? Number.NEGATIVE_INFINITY) < LOOKUP_INTERVAL_MS)
    return { status: "waiting" };
  lastLookupAt.set(job.id, now);

  let lookup: Awaited<ReturnType<StrandedWorkLookup>>;
  try {
    lookup = await (deps.lookUp ?? lookUpLandedWork)({
      clientWorkId,
      chainId,
      garden: job.payload.gardenAddress as Address,
      caller: job.userAddress as Address,
      sinceMs: Math.min(recordedAt, job.createdAt) - CLOCK_DRIFT_MS,
    });
  } catch (error) {
    logger.warn("[StrandedIntent] Could not check whether queued work landed", {
      jobId: job.id,
      error,
    });
    return { status: "waiting" };
  }
  if (lookup.status === "found") {
    lastLookupAt.delete(job.id);
    return { status: "landed", transactionHash: lookup.transactionHash };
  }
  if (lookup.status === "unknown" || age < STRANDED_INTENT_GRACE_MS) return { status: "waiting" };

  // Still absent well after the send: nothing landed, so the work may be sent again.
  delete checkpoint.broadcastPending;
  delete checkpoint.broadcastPendingAt;
  delete checkpoint.broadcast;
  job.meta = { ...job.meta, requiresExplicitSend: true };
  forgetWorkBroadcast(job.id);
  lastLookupAt.delete(job.id);
  await persist(job);
  return { status: "reopened" };
}

/** For the executor: the transaction that landed, or a waiting or reopened error. */
export async function settleStrandedWorkIntent(
  job: Job<WorkJobPayload>,
  chainId: number,
  pendingHash: Hex = "0x",
  deps: Partial<StrandedIntentDependencies> = {}
): Promise<Hex> {
  const resolution = await resolveStrandedWorkIntent(job, chainId, deps);
  if (resolution.status === "landed") return resolution.transactionHash;
  if (resolution.status === "reopened") throw new StrandedWorkIntentReopened();
  throw new AwaitingWorkConfirmation(pendingHash);
}
