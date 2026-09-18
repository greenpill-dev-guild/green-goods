/**
 * Prepare one queued job for Upload all
 *
 * Runs under the job's claim once the connection is confirmed. What the job
 * needs before it can be sent is its kind's business (upload-kinds.ts): a
 * decision is simulated; a work's photos convert, its title resolves, the
 * chain's answer is simulated, and its photos and metadata upload. What
 * preparation found is recorded on the job, so Upload all only has to sign.
 * Nothing here is signed or sent.
 *
 * @module modules/work/prepare-queued-work
 */

import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import { hasRecordedSend, isTerminallyFailedJob } from "../job-queue/queue-policy";
import { saveUnderClaim, type WorkClaim } from "../job-queue/work-claims";
import { SimulationRejected } from "./simulation-rejected";
import { type UploadKindDependencies, uploadKindOf } from "./upload-kinds";
import type { UploadPreparation } from "./upload-state";

export type PreparationResult = UploadPreparation["status"] | "retry-later" | "skipped";

export interface PrepareQueuedJobDependencies extends UploadKindDependencies {
  now: () => number;
  save: typeof saveUnderClaim;
}

export async function prepareQueuedJob(
  job: Job,
  chainId: number,
  claim: Pick<WorkClaim, "token">,
  dependencies: Partial<PrepareQueuedJobDependencies> = {}
): Promise<PreparationResult> {
  const kind = uploadKindOf(job);
  if (!kind || job.synced || hasRecordedSend(job) || isTerminallyFailedJob(job)) return "skipped";
  const save = dependencies.save ?? saveUnderClaim;
  const now = dependencies.now ?? Date.now;
  const record = async (preparation: UploadPreparation): Promise<PreparationResult> => {
    // This answer replaces any wait an earlier send attempt recorded.
    const amend = (target: Job) => {
      const { waitingReason: _reason, waitingForDependency: _waiting, ...meta } = target.meta ?? {};
      target.meta = { ...meta, preparation };
    };
    await save(claim, job.id, amend);
    amend(job);
    return preparation.status;
  };
  const checkedAt = () => new Date(now()).toISOString();

  try {
    const status = await kind.prepare(job, { chainId, claim, save, dependencies });
    return await record({ status, checkedAt: checkedAt() });
  } catch (error) {
    if (error instanceof Error && error.message === "submission-ownership-changed")
      return "skipped";
    // The chain refused it: the same send would revert, so it waits for the person.
    if (error instanceof SimulationRejected && error.definitive)
      return record({ status: "blocked", reason: error.reason, checkedAt: checkedAt() }).catch(
        () => "retry-later" as const
      );
    logger.warn("[UploadPreparation] Queued item will be prepared again later", {
      jobId: job.id,
      kind: job.kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return "retry-later";
  }
}
