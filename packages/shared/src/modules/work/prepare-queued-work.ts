/**
 * Prepare one queued work or decision for Upload all
 *
 * Runs under the job's claim once the connection is confirmed. A decision is
 * simulated. A work's HEIC photos convert, its title resolves, the chain's
 * answer is simulated, and its photos and metadata upload, each saved as it
 * lands. What preparation found is recorded on the job, so Upload all only has
 * to sign. Nothing here is signed or sent.
 *
 * @module modules/work/prepare-queued-work
 */

import type { Address } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/work-media";
import { logger } from "../app/logger";
import { jobQueueDB } from "../job-queue/db";
import { convertQueuedHeicMedia } from "../job-queue/job-media-conversion";
import { hasRecordedSend, isTerminallyFailedJob } from "../job-queue/queue-policy";
import { saveUnderClaim, type WorkClaim } from "../job-queue/work-claims";
import {
  buildQueuedApprovalDraft,
  buildQueuedWorkDraft,
  resolveQueuedWorkTitle,
} from "./queued-work-draft";
import { SimulationRejected } from "./simulation-rejected";
import { isUploadJob, type UploadPreparation } from "./upload-state";

export type PreparationResult = UploadPreparation["status"] | "retry-later" | "skipped";

// The simulation and the encoders load on first use: the offline shell must not carry them.
type Simulation = typeof import("./simulate");
type Encoders = typeof import("../../utils/eas/encoders");

export interface PrepareQueuedJobDependencies {
  now: () => number;
  convertMedia: typeof convertQueuedHeicMedia;
  images: (jobId: string) => ReturnType<typeof jobQueueDB.getImagesForJob>;
  resolveTitle: typeof resolveQueuedWorkTitle;
  simulateWork: Simulation["simulateWorkSubmission"];
  simulateApproval: Simulation["simulateApprovalSubmission"];
  encodeWork: Encoders["encodeWorkData"];
  save: typeof saveUnderClaim;
}

/**
 * Upload progress from this run, laid over what storage holds. Only uploads
 * are taken from memory: a send the store recorded is never overwritten.
 */
export function mergeUploadProgress(
  stored: WorkUploadCheckpoint | undefined,
  progress: WorkUploadCheckpoint
): WorkUploadCheckpoint {
  return {
    ...(stored ?? { submittedAt: progress.submittedAt }),
    files: { ...stored?.files, ...progress.files },
    ...(progress.metadata ? { metadata: progress.metadata } : {}),
  };
}

export async function prepareQueuedJob(
  job: Job,
  chainId: number,
  claim: Pick<WorkClaim, "token">,
  dependencies: Partial<PrepareQueuedJobDependencies> = {}
): Promise<PreparationResult> {
  if (job.synced || !isUploadJob(job) || hasRecordedSend(job) || isTerminallyFailedJob(job))
    return "skipped";
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
    if (job.kind === "approval") {
      const payload = job.payload as ApprovalJobPayload;
      const simulateApproval =
        dependencies.simulateApproval ?? (await import("./simulate")).simulateApprovalSubmission;
      await simulateApproval({
        draft: buildQueuedApprovalDraft(payload),
        gardenAddress: payload.gardenAddress,
        chainId,
        accountAddress: job.userAddress as Address,
      });
      return await record({ status: "ready", checkedAt: checkedAt() });
    }

    const work = job as Job<WorkJobPayload>;
    const conversion = await (dependencies.convertMedia ?? convertQueuedHeicMedia)(work);
    if (conversion.status !== "ready")
      return await record({
        status: conversion.status === "pending" ? "photo-pending" : "photo-needs-attention",
        checkedAt: checkedAt(),
      });

    const images = await (dependencies.images ?? ((id) => jobQueueDB.getImagesForJob(id)))(work.id);
    const actionTitle = await (dependencies.resolveTitle ?? resolveQueuedWorkTitle)(work, chainId, {
      persist: (titled) =>
        save(claim, titled.id, (stored) => {
          (stored.payload as WorkJobPayload).title = titled.payload.title;
        }),
    });
    const draft = buildQueuedWorkDraft(
      work.payload,
      images.map((image) => image.file),
      actionTitle
    );
    const simulateWork =
      dependencies.simulateWork ?? (await import("./simulate")).simulateWorkSubmission;
    await simulateWork({
      draft,
      gardenAddress: work.payload.gardenAddress,
      actionUID: work.payload.actionUID,
      actionTitle,
      chainId,
      images: draft.media,
      accountAddress: work.userAddress as Address,
    });
    const encodeWork =
      dependencies.encodeWork ?? (await import("../../utils/eas/encoders")).encodeWorkData;
    await encodeWork(draft, chainId, {
      clientWorkId: work.payload.clientWorkId,
      checkpoint: work.payload.uploadCheckpoint,
      onCheckpoint: async (progress) => {
        await save(claim, work.id, (stored) => {
          const payload = stored.payload as WorkJobPayload;
          payload.uploadCheckpoint = mergeUploadProgress(payload.uploadCheckpoint, progress);
        });
        work.payload.uploadCheckpoint = mergeUploadProgress(
          work.payload.uploadCheckpoint,
          progress
        );
      },
      gardenAddress: work.payload.gardenAddress,
    });
    return await record({ status: "ready", checkedAt: checkedAt() });
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
