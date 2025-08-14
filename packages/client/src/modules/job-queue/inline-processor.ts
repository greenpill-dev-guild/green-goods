import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import { workProcessor } from "./processors/work";
import { approvalProcessor } from "./processors/approval";

/**
 * Inline processors for jobs, using the given smart account client directly.
 * These mirror the queue processors, but are callable from providers.
 */

export async function processWorkJobInline(
  jobId: string,
  chainId: number,
  smartAccountClient: unknown
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job) return { success: false, error: "job_not_found" };
  if (job.kind !== "work") return { success: false, error: "wrong_kind" };

  try {
    jobQueueEventBus.emit("job:processing", { jobId, job });

    // Load images
    const images = await jobQueueDB.getImagesForJob(jobId);
    const payload = {
      ...(job.payload as WorkJobPayload),
      media: images.map((img) => img.file),
    };

    // Encode and execute via existing processor helpers
    const encoded = await workProcessor.encodePayload(payload, chainId);
    const txHash = await workProcessor.execute(encoded as any, job.meta || {}, smartAccountClient);

    // Mark and cleanup
    await jobQueueDB.markJobSynced(jobId, txHash);
    try {
      await jobQueueDB.deleteJob(jobId);
    } catch {}

    jobQueueEventBus.emit("job:completed", { jobId, job, txHash });
    return { success: true, txHash };
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    await jobQueueDB.markJobFailed(jobId, msg);
    const updated = (await jobQueueDB.getJob(jobId)) || job;
    jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: msg });
    return { success: false, error: msg };
  }
}

export async function processApprovalJobInline(
  jobId: string,
  chainId: number,
  smartAccountClient: unknown
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job) return { success: false, error: "job_not_found" };
  if (job.kind !== "approval") return { success: false, error: "wrong_kind" };

  try {
    jobQueueEventBus.emit("job:processing", { jobId, job });

    // Encode and execute via existing processor helpers
    const encoded = await approvalProcessor.encodePayload(
      job.payload as ApprovalJobPayload,
      chainId
    );
    const txHash = await approvalProcessor.execute(
      encoded as any,
      job.meta || {},
      smartAccountClient
    );

    await jobQueueDB.markJobSynced(jobId, txHash);
    try {
      await jobQueueDB.deleteJob(jobId);
    } catch {}

    jobQueueEventBus.emit("job:completed", { jobId, job, txHash });
    return { success: true, txHash };
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    await jobQueueDB.markJobFailed(jobId, msg);
    const updated = (await jobQueueDB.getJob(jobId)) || job;
    jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: msg });
    return { success: false, error: msg };
  }
}
