import type { Job, WorkJobPayload } from "../../types/job-queue";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { createJobMediaRows, findExistingWorkJob, serializeJobPayload } from "./db-media";
import type { JobQueueDatabase } from "./db-schema";
import { trackPrivateQueueEvent } from "./job-analytics";
import { workCompletionScope } from "./work-completions";
import { dependentWorkLinkPayload } from "../commitment-pooling/work-link-intent";
import { canonicalJobPayload, commitmentJobIdentity } from "../commitment-pooling/job-identity";
import { payloadWithoutSendRecord } from "./queue-policy";

/** Work, its files and its dependent link are admitted as one durable write. */
export async function admitStoredJob<T = unknown>(
  db: JobQueueDatabase,
  job: Omit<Job<T>, "id" | "createdAt" | "attempts" | "synced">
): Promise<string> {
  // Validate userAddress is provided (required for user-scoped queries)
  if (!job.userAddress) {
    throw new Error("userAddress is required when adding a job");
  }

  if (job.kind === "work") {
    const clientId = (job.payload as WorkJobPayload).clientWorkId;
    if (clientId && job.chainId) {
      const completed = await db.work_completions.get(
        workCompletionScope(job.userAddress, job.chainId, clientId)
      );
      if (completed) return completed.jobId;
    }
  }
  const id = crypto.randomUUID();
  const timestamp = Date.now();

  const jobData: Job<T> = {
    ...job,
    userAddress: job.userAddress.toLowerCase() as Job["userAddress"],
    id,
    createdAt: timestamp,
    attempts: 0,
    synced: false,
  } as Job<T>;

  if (jobData.kind === "work") {
    const checkpoint = (jobData.payload as WorkJobPayload).uploadCheckpoint;
    if (checkpoint?.transactionHash)
      jobData.meta = {
        ...jobData.meta,
        submittedTxHash: checkpoint.transactionHash,
        waitingForDependency: true,
        waitingReason: "awaiting-confirmation",
      };
  }
  const imageRows = await createJobMediaRows(id, job as Pick<Job, "kind" | "payload">, timestamp);
  jobData.payload = serializeJobPayload(jobData) as T;

  try {
    return await retryOnceAfterQuotaCleanup(() =>
      db.transaction(
        "rw",
        db.jobs,
        db.job_images,
        db.work_completions,
        db.client_work_id_mappings,
        async () => {
          if (jobData.kind === "work") {
            const clientId = (jobData.payload as WorkJobPayload).clientWorkId;
            if (clientId) {
              const completed = await db.work_completions.get(
                workCompletionScope(jobData.userAddress, jobData.chainId!, clientId)
              );
              if (completed) return completed.jobId;
              const legacy = await db.client_work_id_mappings.get(clientId);
              const legacyIsUnscoped =
                legacy &&
                (await db.work_completions
                  .filter((row) => row.clientWorkId === clientId)
                  .count()) === 0;
              if (legacyIsUnscoped) {
                const payload = jobData.payload as WorkJobPayload;
                payload.uploadCheckpoint = {
                  submittedAt: new Date(legacy.createdAt).toISOString(),
                  files: {},
                  ...payload.uploadCheckpoint,
                  transactionHash: legacy.attestationId as `0x${string}`,
                };
                jobData.meta = {
                  ...jobData.meta,
                  legacyConfirmation: true,
                  waitingForDependency: true,
                  waitingReason: "awaiting-confirmation",
                };
              }
            }
          }
          const existing = findExistingWorkJob(
            await db.jobs.where("userAddress").equals(jobData.userAddress).toArray(),
            jobData as Job
          );
          if (existing) return existing.id;
          const dependent =
            jobData.kind === "work"
              ? (jobData.payload as WorkJobPayload).dependentWorkLink
              : undefined;
          if (dependent) {
            const linkedPayload = {
              ...dependentWorkLinkPayload(
                dependent.clientWorkId,
                {
                  commitmentId: dependent.commitmentId,
                  requirementIndex: dependent.requirementIndex,
                  garden: dependent.gardenAddress,
                },
                id
              ),
              operationKey: dependent.operationKey,
            };
            const identity = commitmentJobIdentity("workLink", linkedPayload);
            const existingLink = (
              await db.jobs.where("userAddress").equals(jobData.userAddress).toArray()
            ).find(
              (row) =>
                row.chainId === jobData.chainId &&
                commitmentJobIdentity(row.kind, row.payload) === identity
            );
            if (existingLink) {
              if (
                canonicalJobPayload(payloadWithoutSendRecord(existingLink)) !==
                canonicalJobPayload(linkedPayload)
              )
                throw new Error(`offline_job_identity_conflict:${identity}`);
            } else {
              await db.jobs.add({
                id: crypto.randomUUID(),
                kind: "workLink",
                payload: linkedPayload,
                userAddress: jobData.userAddress,
                chainId: jobData.chainId,
                meta: { chainId: jobData.chainId },
                createdAt: timestamp,
                attempts: 0,
                synced: false,
              });
            }
          }
          await db.jobs.add(jobData as Job);
          if (imageRows.length > 0) await db.job_images.bulkAdd(imageRows);
          return id;
        }
      )
    );
  } catch (error) {
    trackPrivateQueueEvent("job_queue_storage_failed", {
      job_kind: job.kind,
      file_count: imageRows.length,
      total_size: imageRows.reduce((sum, image) => sum + image.fileData.data.byteLength, 0),
    });
    throw error;
  }
}
