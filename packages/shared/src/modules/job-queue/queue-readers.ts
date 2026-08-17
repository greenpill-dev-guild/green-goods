import type { Job, QueueEvent, QueueStats, WorkJobPayload } from "../../types/job-queue";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";

export async function getQueueStats(userAddress: string): Promise<QueueStats> {
  if (!userAddress) throw new Error("userAddress is required when getting stats");
  return jobQueueDB.getStats(userAddress);
}

export async function getQueueJobs(
  userAddress: string,
  filter?: { kind?: string; synced?: boolean }
): Promise<Job[]> {
  if (!userAddress) throw new Error("userAddress is required when getting jobs");
  return jobQueueDB.getJobs({ userAddress, ...filter });
}

export async function getQueueJobsWithImages(
  userAddress: string
): Promise<
  Array<{ job: Job<WorkJobPayload>; images: Array<{ id: string; file: File; url: string }> }>
> {
  if (!userAddress) throw new Error("userAddress is required when getting jobs with images");
  const jobs = (await jobQueueDB.getJobs({
    userAddress,
    kind: "work",
    synced: false,
  })) as Job<WorkJobPayload>[];
  return Promise.all(
    jobs.map(async (job) => ({ job, images: await jobQueueDB.getImagesForJob(job.id) }))
  );
}

export async function hasPendingQueueJobs(userAddress: string): Promise<boolean> {
  if (!userAddress) throw new Error("userAddress is required when checking pending jobs");
  return (await jobQueueDB.getJobs({ userAddress, synced: false })).length > 0;
}

export async function getPendingQueueCount(userAddress: string): Promise<number> {
  if (!userAddress) throw new Error("userAddress is required when getting pending count");
  return (await jobQueueDB.getJobs({ userAddress, synced: false })).length;
}

export function subscribeToQueue(listener: (event: QueueEvent) => void): () => void {
  const unsubscribers = [
    jobQueueEventBus.on("job:added", ({ jobId, job }) =>
      listener({ type: "job_added", jobId, job })
    ),
    jobQueueEventBus.on("job:processing", ({ jobId, job }) =>
      listener({ type: "job_processing", jobId, job })
    ),
    jobQueueEventBus.on("job:completed", ({ jobId, job, txHash }) =>
      listener({ type: "job_completed", jobId, job, txHash })
    ),
    jobQueueEventBus.on("job:failed", ({ jobId, job, error }) =>
      listener({ type: "job_failed", jobId, job, error })
    ),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
