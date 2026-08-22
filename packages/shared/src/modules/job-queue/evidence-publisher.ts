/**
 * Publishing proof that was composed before it could be.
 *
 * Proof is composed with no signal, so the job carries the words and the media
 * and the CID has to exist before `attachEvidence` can be called with it. This
 * module owns that step, under the same contract as the commitment metadata
 * publish in job-executors: report waiting rather than throw, count attempts
 * on their own, and write the CID back the moment it exists.
 *
 * @module modules/job-queue/evidence-publisher
 */

import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import { buildCommitmentEvidenceDocument, evidenceMediaKind } from "../commitment-pooling/evidence";
import type { EvidenceJobPayload } from "../commitment-pooling/jobs";
import { jobQueueDB } from "./db";
import { MAX_RETRIES } from "./queue-policy";

export type PublishOutcome =
  | { published: true }
  | { published: false; reason: string; terminal?: boolean };

/**
 * Media uploads first, each becoming a CID the document names; then the
 * document is pinned and its CID written back to the stored job, so a throw
 * between here and the send cannot lose it.
 *
 * Failure is reported as waiting, never thrown: a dead gateway has nothing to
 * do with this proof and must not spend one of the job's own attempts. The
 * publish attempts are counted separately, so a gateway that never returns
 * still lets the job fail once it has tried as many times as any other.
 */
export async function publishPendingEvidence(jobId: string, job: Job): Promise<PublishOutcome> {
  if (job.kind !== "evidence") return { published: true };
  const payload = job.payload as EvidenceJobPayload;
  if (payload.cid) return { published: true };

  try {
    const { uploadFileToIPFS, uploadJSONToIPFS } = await import("../data/ipfs/upload");
    const files = (await jobQueueDB.getImagesForJob(jobId)).map((image) => image.file);
    const audioFiles = files.filter((file) => file.type.startsWith("audio/"));
    const mediaFiles = files.filter((file) => !file.type.startsWith("audio/"));
    const context = { source: "commitment-evidence", gardenAddress: payload.gardenAddress };

    const media = [];
    for (const [index, file] of mediaFiles.entries()) {
      const { cid } = await uploadFileToIPFS(file, {
        ...context,
        fileIndex: index,
        totalFiles: mediaFiles.length,
      });
      media.push({ cid, mime: file.type, kind: evidenceMediaKind(file.type) });
    }
    const audio = [];
    for (const [index, file] of audioFiles.entries()) {
      const { cid } = await uploadFileToIPFS(file, {
        ...context,
        fileIndex: index,
        totalFiles: audioFiles.length,
      });
      audio.push({ cid, mime: file.type });
    }

    const document = buildCommitmentEvidenceDocument({
      note: payload.note,
      links: (payload.links ?? []).map((url) => ({ url })),
      media,
      audio,
    });
    const { cid } = await uploadJSONToIPFS(document as unknown as Record<string, unknown>, {
      ...context,
      metadataType: "commitment-evidence",
    });
    payload.cid = cid;
    await jobQueueDB.updateJob({ ...job, payload });
    return { published: true };
  } catch (error) {
    const attempts = Number(job.meta?.evidenceAttempts ?? 0) + 1;
    // Mutated, not replaced, for the same reason the metadata step does it:
    // the caller rewrites the job on the waiting path with the meta it holds.
    job.meta = { ...(job.meta ?? {}), evidenceAttempts: attempts };
    await jobQueueDB.updateJob({ ...job });
    logger.warn("[JobQueue] Commitment evidence publish failed", {
      jobId: job.id,
      attempts,
      error: error instanceof Error ? error.message : String(error),
    });
    if (attempts >= MAX_RETRIES) {
      return { published: false, reason: "evidence-unavailable", terminal: true };
    }
    return { published: false, reason: "evidence-unpublished" };
  }
}
