import type { Job, JobKindMap } from "../../types/job-queue";
import { JobMaintenance } from "./job-maintenance";
import { createJobProcessor } from "./process-job";
import type { FlushContext, FlushResult, JobQueueDependencies, JobQueueHandle } from "./ports";
import { canonicalJobPayload, commitmentJobIdentity, isTerminallyFailedJob } from "./queue-policy";
import { createQueueReaders } from "./queue-readers";
import { createJobRecovery } from "./job-recovery";

export function createJobQueue(deps: JobQueueDependencies): JobQueueHandle {
  const readers = createQueueReaders(deps.store, deps.events);
  const recovery = createJobRecovery(deps.store, deps.events);
  const maintenance = new JobMaintenance(deps.store, deps.analytics, deps.logger);
  const processJob = createJobProcessor({ ...deps, maintenance });
  let flushPromise: Promise<FlushResult> | null = null;
  let cachedStorageQuota: Awaited<ReturnType<typeof deps.quota.get>> | null = null;
  let cachedStorageQuotaFetchedAt = 0;
  const detachLifecycle = deps.lifecycle.attach(() => undefined);

  const getCachedStorageQuota = async () => {
    const now = deps.clock.now();
    if (
      cachedStorageQuota &&
      now - cachedStorageQuotaFetchedAt < deps.config.storageQuotaCacheTTL
    ) {
      return cachedStorageQuota;
    }
    cachedStorageQuota = await deps.quota.get();
    cachedStorageQuotaFetchedAt = now;
    return cachedStorageQuota;
  };

  const flushInternal = async (context: FlushContext): Promise<FlushResult> => {
    if (!context.userAddress) throw new Error("userAddress is required for flush operation");
    const jobs = await deps.store.getJobs({ userAddress: context.userAddress, synced: false });
    if (jobs.length === 0) {
      const result = { processed: 0, failed: 0, skipped: 0 };
      deps.events.emit("queue:sync-completed", { result });
      return result;
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      try {
        const result = await deps.scheduler.schedule(() => processJob(job.id, context));
        if (result.success) processed += 1;
        else if (result.skipped) skipped += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        deps.events.emit("job:failed", { jobId: job.id, job, error: errorMessage });
      }
      if ((index + 1) % 3 === 0 && index + 1 < jobs.length) await deps.scheduler.yield();
    }
    const result = { processed, failed, skipped };
    deps.events.emit("queue:sync-completed", { result });
    return result;
  };

  return {
    async addJob<K extends keyof JobKindMap>(
      kind: K,
      payload: JobKindMap[K],
      userAddress: string,
      meta?: Record<string, unknown>
    ): Promise<string> {
      if (!userAddress) throw new Error("userAddress is required when adding a job");
      const chainId = (meta as { chainId?: number })?.chainId || deps.config.defaultChainId;
      const isOnline = deps.connectivity.isOnline();
      const persistedPayload = deps.admission.prepare({ kind, payload, chainId, userAddress });
      const identity = commitmentJobIdentity(kind, persistedPayload);
      if (identity) {
        const existingJobs = await deps.store.getJobs({ userAddress, kind: String(kind) });
        const existing = existingJobs.find(
          (job) =>
            !isTerminallyFailedJob(job) && commitmentJobIdentity(job.kind, job.payload) === identity
        );
        if (existing) {
          if (canonicalJobPayload(existing.payload) !== canonicalJobPayload(persistedPayload)) {
            throw new Error(`offline_job_identity_conflict:${identity}`);
          }
          return existing.id;
        }
      }

      deps.analytics.storageWarning(kind, await getCachedStorageQuota(), isOnline);
      const jobId = await deps.store.addJob({
        kind,
        payload: persistedPayload,
        meta: { chainId, ...meta },
        chainId,
        userAddress,
      });
      const job: Job = {
        id: jobId,
        kind,
        payload: persistedPayload,
        meta: { chainId, ...meta },
        chainId,
        userAddress,
        createdAt: deps.clock.now(),
        attempts: 0,
        synced: false,
      };
      deps.analytics.jobCreated(kind, isOnline, chainId);
      if (import.meta.env?.VITE_QUEUE_DEBUG === "true") {
        const value = persistedPayload as unknown as Record<string, unknown>;
        const mediaCount = Array.isArray(value?.media) ? value.media.length : 0;
        deps.logger.debug("[JobQueue] addJob", {
          jobId,
          kind,
          chainId,
          userAddress,
          isOnline,
          mediaCount,
        });
      }
      deps.events.emit("job:added", { jobId, job });
      try {
        deps.backgroundSync.request();
      } catch (error) {
        deps.logger.debug("[JobQueue] Failed to register background sync", { error });
      }
      return jobId;
    },

    processJob,

    flush(context) {
      if (flushPromise) return flushPromise;
      flushPromise = flushInternal(context).finally(() => {
        flushPromise = null;
      });
      return flushPromise;
    },

    retryJob: recovery.retryJob,
    discardJob: recovery.discardJob,
    getStats: readers.getStats,
    getJobs: readers.getJobs,
    getJobsWithImages: readers.getJobsWithImages,
    hasPendingJobs: readers.hasPendingJobs,
    getPendingCount: readers.getPendingCount,
    subscribe: readers.subscribe,
    onSyncCompleted(listener) {
      return deps.events.on("queue:sync-completed", ({ result }) => listener(result));
    },
    onBackgroundSyncRequested(listener) {
      return deps.events.on("background:sync-requested", listener);
    },
    async cleanup() {
      detachLifecycle();
      await deps.store.cleanup();
    },
  };
}
