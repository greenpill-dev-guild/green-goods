import type { Job, QueueEvent, QueueStats, WorkJobPayload } from "../../types/job-queue";
import type { JobQueueEvents, JobQueueStore } from "./ports";

export function createQueueReaders(store: JobQueueStore, events: JobQueueEvents) {
  return {
    async getStats(userAddress: string): Promise<QueueStats> {
      if (!userAddress) throw new Error("userAddress is required when getting stats");
      return store.getStats(userAddress);
    },
    async getJobs(
      userAddress: string,
      filter?: { kind?: string; synced?: boolean }
    ): Promise<Job[]> {
      if (!userAddress) throw new Error("userAddress is required when getting jobs");
      return store.getJobs({ userAddress, ...filter });
    },
    async getJobsWithImages(userAddress: string) {
      if (!userAddress) throw new Error("userAddress is required when getting jobs with images");
      const jobs = (await store.getJobs({
        userAddress,
        kind: "work",
        synced: false,
      })) as Job<WorkJobPayload>[];
      return Promise.all(
        jobs.map(async (job) => ({ job, images: await store.getImagesForJob(job.id) }))
      );
    },
    async hasPendingJobs(userAddress: string): Promise<boolean> {
      if (!userAddress) throw new Error("userAddress is required when checking pending jobs");
      return (await store.getJobs({ userAddress, synced: false })).length > 0;
    },
    async getPendingCount(userAddress: string): Promise<number> {
      if (!userAddress) throw new Error("userAddress is required when getting pending count");
      return (await store.getJobs({ userAddress, synced: false })).length;
    },
    subscribe(listener: (event: QueueEvent) => void): () => void {
      const unsubscribers = [
        events.on("job:added", ({ jobId, job }) => listener({ type: "job_added", jobId, job })),
        events.on("job:processing", ({ jobId, job }) =>
          listener({ type: "job_processing", jobId, job })
        ),
        events.on("job:completed", ({ jobId, job, txHash }) =>
          listener({ type: "job_completed", jobId, job, txHash })
        ),
        events.on("job:failed", ({ jobId, job, error }) =>
          listener({ type: "job_failed", jobId, job, error })
        ),
      ];
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
  };
}
