/**
 * Offline Work Utilities
 *
 * Utilities for converting job queue entries to Work objects.
 *
 * @module utils/work/offline
 */

import { jobToWork } from "../../hooks/work/useWorks";
import { jobQueueDB } from "../../modules/job-queue";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { Work } from "../../types/domain";

/**
 * Convert job queue entries to Work objects with media
 *
 * Loads images from IndexedDB and attaches them to the work object.
 *
 * @param jobs - Job queue entries
 * @param activeAddress - Current user's address (to set as gardenerAddress)
 * @returns Work objects with media attached
 */
export async function convertJobsToWorks(
  jobs: Job<WorkJobPayload>[],
  activeAddress?: string
): Promise<Work[]> {
  return Promise.all(
    jobs.map(async (job) => {
      const work = jobToWork(job);
      const images = await jobQueueDB.getImagesForJob(job.id);
      work.media = images.map((img) => img.url);
      if (activeAddress) {
        work.gardenerAddress = activeAddress;
      }
      return work;
    })
  );
}

/**
 * Fetch offline works from job queue and convert to Work objects
 * Jobs are scoped to the current user's address
 *
 * @param userAddress - Current user's address (required for user-scoped queue)
 * @param gardenId - Optional garden ID to filter by
 * @returns Work objects from job queue
 */
export async function fetchOfflineWorks(userAddress: string, gardenId?: string): Promise<Work[]> {
  if (!userAddress) {
    return [];
  }

  const { jobQueue } = await import("../../modules/job-queue");

  const jobs = await jobQueue.getJobs(userAddress, { kind: "work", synced: false });

  // Filter by garden if specified
  const filteredJobs = gardenId
    ? jobs.filter((job) => (job.payload as WorkJobPayload).gardenAddress === gardenId)
    : jobs;

  return convertJobsToWorks(filteredJobs as Job<WorkJobPayload>[], userAddress);
}
