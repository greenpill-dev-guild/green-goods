import type { WorkJobPayload } from "../../types/job-queue";
import type { JobQueueDatabase } from "./db-schema";

export function workCompletionScope(
  address: string,
  chainId: number,
  clientWorkId: string
): string {
  return `${chainId}:${address.toLowerCase()}:${clientWorkId}`;
}

/** Called inside the queue's transaction so the preview and ID mapping commit together. */
export async function recordWorkCompletion(
  db: Pick<JobQueueDatabase, "jobs" | "work_completions">,
  clientWorkId: string,
  transactionHash: string,
  jobId: string
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job?.chainId) return;
  const scope = workCompletionScope(job.userAddress, job.chainId, clientWorkId);
  const previous = await db.work_completions.get(scope);
  const work = (job.payload as WorkJobPayload).confirmedWork ?? previous?.work;
  await db.work_completions.put({
    scope,
    clientWorkId,
    userAddress: job.userAddress.toLowerCase(),
    chainId: job.chainId,
    transactionHash,
    ...(work ? { work } : {}),
    jobId,
    createdAt: Date.now(),
  });
}
