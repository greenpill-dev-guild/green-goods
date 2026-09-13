/**
 * Offline Work Utilities
 *
 * Utilities for converting job queue entries to Work objects.
 *
 * @module utils/work/offline
 */

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { jobToWork } from "../../hooks/work/useWorks";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import type { Address, Work } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";

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
  activeAddress?: Address
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
export async function fetchOfflineWorks(
  userAddress: Address,
  gardenId?: string,
  chainId = DEFAULT_CHAIN_ID,
  options: { includeMedia?: boolean } = {}
): Promise<Work[]> {
  if (!userAddress) {
    return [];
  }

  // Read the queue through a static import: this runs while offline, where a
  // lazily loaded module cannot be fetched and the queued work would vanish.
  const jobs = await jobQueue.getJobs(userAddress, { kind: "work", synced: false });

  // Filter by garden if specified
  const filteredJobs = jobs.filter(
    (job) =>
      (job.chainId ?? DEFAULT_CHAIN_ID) === chainId &&
      job.userAddress.toLowerCase() === userAddress.toLowerCase() &&
      (!gardenId ||
        (job.payload as WorkJobPayload).gardenAddress.toLowerCase() === gardenId.toLowerCase())
  );

  return options.includeMedia === false
    ? filteredJobs.map((job) => jobToWork(job as Job<WorkJobPayload>))
    : convertJobsToWorks(filteredJobs as Job<WorkJobPayload>[], userAddress);
}
