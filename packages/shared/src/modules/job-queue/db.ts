import { liveQuery, type Observable } from "dexie";
import type { Job, QueueStats, WorkJobPayload } from "../../types/job-queue";
import { deserializeFile } from "../../utils/storage/file-serialization";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { createLogger } from "../app/logger";
import { restoreWorkFile } from "../work/work-attachments";
import { createJobMediaRows, findExistingWorkJob, serializeJobPayload } from "./db-media";
import { JobQueueDatabase, type WorkCompletion } from "./db-schema";
import { isTerminalDatabaseOpenError, openDexieDatabase } from "./database-open";
import { loadFailedDeleteIds, saveFailedDeleteIds } from "./failed-delete-storage";
import { trackPrivateQueueEvent } from "./job-analytics";
import { mediaResourceManager } from "./media-resource-manager";

const log = createLogger({ source: "job-queue/db" });
export const CLAIM_TTL_MS = 60_000;
const STALE_URL_AGE_MS = 60 * 60 * 1000;

export interface JobFilter {
  userAddress: string;
  kind?: string;
  synced?: boolean;
}

function workScope(address: string, chainId: number, clientWorkId: string): string {
  return `${chainId}:${address.toLowerCase()}:${clientWorkId}`;
}

/**
 * The queue's durable storage: one connection per tab, reopened after another
 * tab upgrades the schema, with live views over the tables for the screens
 * that watch pending work.
 */
class JobQueueStore {
  private db: JobQueueDatabase | null = null;
  private opening: Promise<JobQueueDatabase> | null = null;

  async init(): Promise<JobQueueDatabase> {
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    this.opening = this.open();
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  private async open(): Promise<JobQueueDatabase> {
    const db = new JobQueueDatabase();
    const forget = () => {
      if (this.db === db) this.db = null;
    };
    // Another tab wants to upgrade, or the browser dropped the connection:
    // let go now and open a fresh connection on the next call.
    db.on("versionchange", () => {
      db.close();
      forget();
    });
    db.on("close", forget);
    await openDexieDatabase(db, "job-queue-database");
    this.db = db;
    await this.cleanupStaleUrls();
    return db;
  }

  /**
   * Revoke object URLs older than an hour and drop image rows whose job is
   * gone or synced. Pending jobs keep their rows so files can be reloaded.
   */
  private async cleanupStaleUrls(): Promise<void> {
    try {
      const db = await this.init();
      const cutoff = Date.now() - STALE_URL_AGE_MS;
      await db.transaction("rw", db.job_images, db.jobs, async () => {
        const stale = await db.job_images.where("createdAt").belowOrEqual(cutoff).toArray();
        for (const image of stale) {
          const job = await db.jobs.get(image.jobId);
          if (image.url) mediaResourceManager.cleanupUrl(image.url);
          if (!job || job.synced) await db.job_images.delete(image.id);
        }
      });
    } catch (error) {
      log.error("Failed to cleanup stale URLs", { error });
    }
  }

  async addJob<T = unknown>(
    job: Omit<Job<T>, "id" | "createdAt" | "attempts" | "synced">
  ): Promise<string> {
    // Validate userAddress is provided (required for user-scoped queries)
    if (!job.userAddress) {
      throw new Error("userAddress is required when adding a job");
    }

    const db = await this.init();
    if (job.kind === "work") {
      const clientId = (job.payload as WorkJobPayload).clientWorkId;
      if (clientId && job.chainId) {
        const completed = await this.getWorkCompletion(job.userAddress, job.chainId, clientId);
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
                  workScope(jobData.userAddress, jobData.chainId!, clientId)
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

  async getJobs(filter: JobFilter): Promise<Job[]> {
    if (!filter.userAddress) {
      throw new Error("userAddress is required when getting jobs");
    }
    const db = this.db ?? (await this.init());
    const rows = await db.jobs
      .where("userAddress")
      .equals(filter.userAddress.toLowerCase())
      .toArray();
    return rows.filter(
      (job) =>
        (filter.synced === undefined || job.synced === filter.synced) &&
        (!filter.kind || job.kind === filter.kind)
    );
  }

  /**
   * Open before constructing the live query: a first open may run an upgrade,
   * which Dexie rejects inside a live query. Retry once, then surface failure.
   */
  private observe<T>(read: () => Promise<T>): Observable<T> {
    return {
      subscribe: (...args: Parameters<Observable<T>["subscribe"]>) => {
        let inner: { unsubscribe: () => void } | undefined;
        let stopped = false;
        const reportError = (error: unknown) => {
          const [observerOrNext, onError] = args as unknown as [
            { error?: (reason: unknown) => void } | ((value: T) => void) | undefined,
            ((reason: unknown) => void) | undefined,
          ];
          if (typeof observerOrNext === "object") observerOrNext?.error?.(error);
          else onError?.(error);
        };
        void (async () => {
          let lastError: unknown;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await this.init();
              if (!stopped) inner = liveQuery(() => read()).subscribe(...args);
              return;
            } catch (error) {
              lastError = error;
              // A second request queues behind the same stale connection and
              // cannot recover until another tab closes. Surface that state
              // now; a later subscription gets a fresh open attempt.
              if (isTerminalDatabaseOpenError(error, "job-queue-database")) break;
            }
          }
          if (!stopped) reportError(lastError);
        })();
        return {
          closed: false,
          unsubscribe: () => {
            stopped = true;
            inner?.unsubscribe();
          },
        };
      },
    } as Observable<T>;
  }

  /** The user's jobs as a live view; it re-emits when the table changes in this tab or another. */
  observeJobs(filter: JobFilter): Observable<Job[]> {
    return this.observe(() => this.getJobs(filter));
  }

  observeStats(userAddress: string): Observable<QueueStats> {
    return this.observe(() => this.getStats(userAddress));
  }

  /**
   * Get all jobs without user filtering (for admin/migration purposes only).
   * WARNING: This returns jobs from ALL users - use with caution.
   */
  async getAllJobsUnfiltered(): Promise<Job[]> {
    const db = await this.init();
    return db.jobs.toArray();
  }

  async getJob(id: string): Promise<Job | undefined> {
    const db = await this.init();
    return db.jobs.get(id);
  }

  /**
   * Every job write goes through here, and a record that is gone stays gone.
   * Discarding takes no claim, so it can delete a job the queue still holds
   * and is about to write to. Putting that job back would return it without
   * its photos, which discarding deleted along with it.
   */
  private async putStoredJob(id: string, next: (stored: Job) => Job): Promise<void> {
    const db = await this.init();
    await db.transaction("rw", db.jobs, async () => {
      const stored = await db.jobs.get(id);
      if (stored) await db.jobs.put(next(stored));
    });
  }

  /** Replace a stored job with this one. */
  async updateJob(job: Job): Promise<void> {
    await this.putStoredJob(job.id, () => ({ ...job, payload: serializeJobPayload(job) }));
  }

  /** Change part of a stored job in place, keeping the form storage gave it. */
  async amendJob(id: string, amend: (job: Job) => void): Promise<void> {
    await this.putStoredJob(id, (stored) => {
      amend(stored);
      return stored;
    });
  }

  markJobSynced(id: string, txHash?: string): Promise<void> {
    return this.amendJob(id, (job) => {
      job.synced = true;
      delete job.lastError;
      if (txHash && job.meta) job.meta.txHash = txHash;
    });
  }

  markJobFailed(id: string, error: string): Promise<void> {
    return this.amendJob(id, (job) => {
      job.lastError = error;
      job.attempts += 1;
      job.lastAttemptAt = Date.now();
    });
  }

  markJobTerminalFailed(id: string, error: string): Promise<void> {
    return this.amendJob(id, (job) => {
      job.lastError = error;
      job.attempts = Math.max(job.attempts, 5);
      job.lastAttemptAt = Date.now();
    });
  }

  async getImagesForJob(jobId: string): Promise<Array<{ id: string; file: File; url: string }>> {
    const db = await this.init();
    const images = await db.job_images.where("jobId").equals(jobId).toArray();
    // Back to File objects, from the serialized rows or the legacy File rows.
    return images
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      .map((img) => ({
        id: img.id,
        file:
          img.contentHash && img.fileData?.data
            ? restoreWorkFile(img.fileData, img.attachmentId ?? img.id, img.contentHash)
            : deserializeFile(img, `work-${jobId}`, img.id),
        url: "",
      }));
  }

  async deleteJob(id: string): Promise<void> {
    const db = await this.init();
    await db.transaction("rw", db.job_images, db.jobs, async () => {
      await db.job_images.where("jobId").equals(id).delete();
      await db.jobs.delete(id);
    });
    // Clean up all URLs associated with this job
    mediaResourceManager.cleanupUrls(id);
  }

  async getStats(userAddress: string): Promise<QueueStats> {
    if (!userAddress) {
      throw new Error("userAddress is required when getting stats");
    }
    const userJobs = await this.getJobs({ userAddress });
    return {
      total: userJobs.length,
      pending: userJobs.filter((job) => !job.synced && !job.lastError).length,
      failed: userJobs.filter((job) => !job.synced && Boolean(job.lastError)).length,
      synced: userJobs.filter((job) => job.synced).length,
    };
  }

  async storeClientWorkIdMapping(
    clientWorkId: string,
    attestationId: string,
    jobId: string
  ): Promise<void> {
    const db = await this.init();
    await db.transaction(
      "rw",
      db.jobs,
      db.work_completions,
      db.client_work_id_mappings,
      async () => {
        const job = await db.jobs.get(jobId);
        if (job?.chainId) {
          await db.work_completions.put({
            scope: workScope(job.userAddress, job.chainId, clientWorkId),
            clientWorkId,
            userAddress: job.userAddress.toLowerCase(),
            chainId: job.chainId,
            transactionHash: attestationId,
            jobId,
            createdAt: Date.now(),
          });
        }
        await db.client_work_id_mappings.put({
          clientWorkId,
          attestationId,
          jobId,
          createdAt: Date.now(),
        });
      }
    );
  }

  async getWorkCompletion(
    address: string,
    chainId: number,
    clientWorkId: string
  ): Promise<WorkCompletion | undefined> {
    const db = await this.init();
    return db.work_completions.get(workScope(address, chainId, clientWorkId));
  }

  async acquireExecutionClaim(ids: string[], token: string): Promise<boolean> {
    const db = await this.init();
    return db.transaction("rw", db.execution_claims, async () => {
      const now = Date.now();
      const claims = await db.execution_claims.bulkGet(ids);
      if (claims.some((claim) => claim && claim.token !== token && claim.expiresAt > now)) {
        return false;
      }
      await db.execution_claims.bulkPut(
        ids.map((id) => ({ id, token, expiresAt: now + CLAIM_TTL_MS }))
      );
      return true;
    });
  }

  async renewExecutionClaim(ids: string[], token: string): Promise<boolean> {
    const db = await this.init();
    return db.transaction("rw", db.execution_claims, async () => {
      const claims = await db.execution_claims.bulkGet(ids);
      if (claims.some((claim) => claim?.token !== token)) return false;
      const expiresAt = Date.now() + CLAIM_TTL_MS;
      await db.execution_claims.bulkPut(ids.map((id) => ({ id, token, expiresAt })));
      return true;
    });
  }

  async releaseExecutionClaim(ids: string[], token: string): Promise<void> {
    const db = await this.init();
    await db.transaction("rw", db.execution_claims, async () => {
      const claims = await db.execution_claims.bulkGet(ids);
      await db.execution_claims.bulkDelete(
        ids.filter((_, index) => claims[index]?.token === token)
      );
    });
  }

  async getAttestationIdByClientWorkId(clientWorkId: string): Promise<string | null> {
    const db = await this.init();
    const mapping = await db.client_work_id_mappings.get(clientWorkId);
    return mapping?.attestationId || null;
  }

  async isClientWorkIdUploaded(clientWorkId: string): Promise<boolean> {
    const attestationId = await this.getAttestationIdByClientWorkId(clientWorkId);
    return attestationId !== null;
  }

  async getAllUploadedClientWorkIds(): Promise<Set<string>> {
    const db = await this.init();
    return new Set(await db.client_work_id_mappings.toCollection().primaryKeys());
  }

  async storeClientCommitmentIdMapping(
    clientCommitmentId: string,
    commitmentId: bigint,
    jobId: string,
    chainId: number
  ): Promise<void> {
    const db = await this.init();
    await db.client_commitment_id_mappings.put({
      clientCommitmentId,
      commitmentId: commitmentId.toString(),
      jobId,
      chainId,
      createdAt: Date.now(),
    });
  }

  async getCommitmentIdByClientId(clientCommitmentId: string): Promise<bigint | null> {
    const db = await this.init();
    const mapping = await db.client_commitment_id_mappings.get(clientCommitmentId);
    return mapping ? BigInt(mapping.commitmentId) : null;
  }

  async storeClientSeriesIdMapping(
    clientSeriesId: string,
    seriesId: bigint,
    jobId: string,
    chainId: number
  ): Promise<void> {
    const db = await this.init();
    await db.client_series_id_mappings.put({
      clientSeriesId,
      seriesId: seriesId.toString(),
      jobId,
      chainId,
      createdAt: Date.now(),
    });
  }

  async getSeriesIdByClientId(clientSeriesId: string): Promise<bigint | null> {
    const db = await this.init();
    const mapping = await db.client_series_id_mappings.get(clientSeriesId);
    return mapping ? BigInt(mapping.seriesId) : null;
  }

  /**
   * Cleanup old mappings (older than 30 days)
   */
  async cleanupOldMappings(): Promise<void> {
    // Completion identities protect residual drafts indefinitely. Their compact rows are never browsing cache.
  }

  /**
   * Cleanup all resources when database is no longer needed
   */
  async cleanup(): Promise<void> {
    // Cleanup all URLs managed by MediaResourceManager
    mediaResourceManager.cleanupAll();
    // Cleanup stale URLs in database
    await this.cleanupStaleUrls();
    // Cleanup old clientWorkId mappings
    await this.cleanupOldMappings();
  }

  /**
   * Load failed delete job IDs from localStorage.
   * Uses localStorage instead of IndexedDB for simplicity since this is just a small array.
   */
  async loadFailedDeleteIds(): Promise<string[]> {
    return loadFailedDeleteIds();
  }

  /**
   * Save failed delete job IDs to localStorage.
   */
  async saveFailedDeleteIds(ids: string[]): Promise<void> {
    saveFailedDeleteIds(ids);
  }
}

export const jobQueueDB = new JobQueueStore();
