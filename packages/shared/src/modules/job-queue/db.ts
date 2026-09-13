import type { IDBPDatabase } from "idb";
import { openJobQueueDatabase, type JobQueueDB, type WorkCompletion } from "./db-schema";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { deserializeFile } from "../../utils/storage/file-serialization";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { createLogger } from "../app/logger";
import { restoreWorkFile } from "../work/work-attachments";
import { createJobMediaRows, serializeJobPayload, findExistingWorkJob } from "./db-media";
import { loadFailedDeleteIds, saveFailedDeleteIds } from "./failed-delete-storage";
import { trackPrivateQueueEvent } from "./job-analytics";
import { mediaResourceManager } from "./media-resource-manager";

const log = createLogger({ source: "job-queue/db" });

class JobQueueDatabase {
  private db: IDBPDatabase<JobQueueDB> | null = null;
  private opening: Promise<IDBPDatabase<JobQueueDB>> | null = null;

  async init(): Promise<IDBPDatabase<JobQueueDB>> {
    if (this.db) return this.db;
    if (this.opening) return this.opening;

    this.opening = openJobQueueDatabase(() => {
      this.db?.close();
      this.db = null;
    });

    try {
      this.db = await this.opening;
      await this.cleanupStaleUrls();
      return this.db;
    } finally {
      this.opening = null;
    }
  }

  /**
   * Clean up stale object URLs that are older than 1 hour.
   * IMPORTANT: Only delete image rows for jobs that are already synced or deleted.
   * For pending jobs, only revoke the blob URL (to free memory) but keep the
   * image row so files can be re-loaded when needed.
   */
  private async cleanupStaleUrls(): Promise<void> {
    try {
      const db = await this.init();
      const tx = db.transaction(["job_images", "jobs"], "readwrite");
      const imagesStore = tx.objectStore("job_images");
      const jobsStore = tx.objectStore("jobs");
      const index = imagesStore.index("createdAt");

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const staleImages = await index.getAll(IDBKeyRange.upperBound(oneHourAgo));

      for (const image of staleImages) {
        // Check if the parent job still exists and is pending
        const job = await jobsStore.get(image.jobId);

        // Always revoke the blob URL to free memory
        mediaResourceManager.cleanupUrl(image.url);

        // Only delete the image row if:
        // - The parent job doesn't exist (orphaned image)
        // - The parent job is already synced (completed)
        // For pending jobs, keep the image row so we can regenerate URLs later
        if (!job || job.synced) {
          await imagesStore.delete(image.id);
        }
      }

      await tx.done;
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
    let savedId: string = id;

    try {
      await retryOnceAfterQuotaCleanup(async () => {
        const tx = db.transaction(
          ["jobs", "job_images", "work_completions", "client_work_id_mappings"],
          "readwrite"
        );
        try {
          if (jobData.kind === "work") {
            const clientId = (jobData.payload as WorkJobPayload).clientWorkId;
            if (clientId) {
              const completed = await tx
                .objectStore("work_completions")
                .get(this.workScope(jobData.userAddress, jobData.chainId!, clientId));
              const legacy = await tx.objectStore("client_work_id_mappings").get(clientId);
              const legacyIsUnscoped =
                legacy &&
                !(await tx.objectStore("work_completions").getAll()).some(
                  (row) => row.clientWorkId === clientId
                );
              if (completed) {
                savedId = completed.jobId;
                await tx.done;
                return;
              }
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
            await tx.objectStore("jobs").index("userAddress").getAll(jobData.userAddress),
            jobData
          );
          if (existing) {
            savedId = existing.id;
            await tx.done;
            return;
          }
          await tx.objectStore("jobs").add(jobData as Job);
          for (const imageRow of imageRows) {
            await tx.objectStore("job_images").add(imageRow);
          }
          await tx.done;
        } catch (error) {
          try {
            tx.abort();
          } catch {
            // Transaction may already be aborted; ignore error.
          }
          throw error;
        }
      });
    } catch (error) {
      trackPrivateQueueEvent("job_queue_storage_failed", {
        job_kind: job.kind,
        file_count: imageRows.length,
        total_size: imageRows.reduce((sum, image) => sum + image.fileData.data.byteLength, 0),
      });

      throw error;
    }

    return savedId;
  }

  async getJobs(filter: { userAddress: string; kind?: string; synced?: boolean }): Promise<Job[]> {
    if (!filter.userAddress) {
      throw new Error("userAddress is required when getting jobs");
    }

    const db = await this.init();

    // Use userAddress index and filter additional criteria in memory
    // This is more compatible with fake-indexeddb used in tests
    const tx = db.transaction("jobs", "readonly");
    const index = tx.objectStore("jobs").index("userAddress");
    let result: Job[] = await index.getAll(filter.userAddress.toLowerCase());

    // Apply synced filter in memory
    if (filter.synced !== undefined) {
      result = result.filter((job) => job.synced === filter.synced);
    }

    // Apply kind filter in memory
    if (filter.kind) {
      result = result.filter((job) => job.kind === filter.kind);
    }

    return result;
  }

  /**
   * Get all jobs without user filtering (for admin/migration purposes only).
   * WARNING: This returns jobs from ALL users - use with caution.
   */
  async getAllJobsUnfiltered(): Promise<Job[]> {
    const db = await this.init();
    return await db.getAll("jobs");
  }

  async getJob(id: string): Promise<Job | undefined> {
    const db = await this.init();
    return await db.get("jobs", id);
  }

  async updateJobs(jobs: Job[]): Promise<void> {
    const db = await this.init();
    const tx = db.transaction("jobs", "readwrite");
    try {
      for (const job of jobs) await tx.store.put({ ...job, payload: serializeJobPayload(job) });
      await tx.done;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  async updateJob(job: Job): Promise<void> {
    const db = await this.init();
    await db.put("jobs", { ...job, payload: serializeJobPayload(job) });
  }

  async markJobSynced(id: string, txHash?: string): Promise<void> {
    const db = await this.init();
    const job = await db.get("jobs", id);

    if (job) {
      job.synced = true;
      delete job.lastError;
      if (txHash && job.meta) {
        job.meta.txHash = txHash;
      }
      await db.put("jobs", job);
    }
  }

  async markJobFailed(id: string, error: string): Promise<void> {
    const db = await this.init();
    const job = await db.get("jobs", id);

    if (job) {
      job.lastError = error;
      job.attempts += 1;
      job.lastAttemptAt = Date.now();
      await db.put("jobs", job);
    }
  }

  async markJobTerminalFailed(id: string, error: string): Promise<void> {
    const db = await this.init();
    const job = await db.get("jobs", id);
    if (!job) return;
    job.lastError = error;
    job.attempts = Math.max(job.attempts, 5);
    job.lastAttemptAt = Date.now();
    await db.put("jobs", job);
  }

  async getImagesForJob(jobId: string): Promise<Array<{ id: string; file: File; url: string }>> {
    const db = await this.init();
    const tx = db.transaction("job_images", "readonly");
    const index = tx.objectStore("job_images").index("jobId");
    const images = await index.getAll(jobId);

    // Deserialize files from IndexedDB format back to File objects.
    // Handles both new serialized format and legacy File format.
    const result = images
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      .map((img) => {
        const file =
          img.contentHash && img.fileData?.data
            ? restoreWorkFile(img.fileData, img.attachmentId ?? img.id, img.contentHash)
            : deserializeFile(img, `work-${jobId}`, img.id);

        return {
          id: img.id,
          file,
          url: "",
        };
      });

    return result;
  }

  async deleteJob(id: string): Promise<void> {
    const db = await this.init();

    // Clean up associated images using MediaResourceManager
    const images = await this.getImagesForJob(id);
    for (const image of images) {
      await db.delete("job_images", image.id);
    }

    // Clean up all URLs associated with this job
    mediaResourceManager.cleanupUrls(id);

    await db.delete("jobs", id);
  }

  async clearSyncedJobs(userAddress: string): Promise<void> {
    if (!userAddress) {
      throw new Error("userAddress is required when clearing synced jobs");
    }

    await this.init();
    const syncedJobs = await this.getJobs({ userAddress, synced: true });

    for (const job of syncedJobs) {
      await this.deleteJob(job.id);
    }
  }

  async getStats(
    userAddress: string
  ): Promise<{ total: number; pending: number; failed: number; synced: number }> {
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
    const tx = db.transaction(["jobs", "work_completions", "client_work_id_mappings"], "readwrite");
    const job = await tx.objectStore("jobs").get(jobId);
    if (job?.chainId) {
      await tx.objectStore("work_completions").put({
        scope: this.workScope(job.userAddress, job.chainId, clientWorkId),
        clientWorkId,
        userAddress: job.userAddress.toLowerCase(),
        chainId: job.chainId,
        transactionHash: attestationId,
        jobId,
        createdAt: Date.now(),
      });
    }
    await tx
      .objectStore("client_work_id_mappings")
      .put({ clientWorkId, attestationId, jobId, createdAt: Date.now() });
    await tx.done;
  }

  private workScope(address: string, chainId: number, clientWorkId: string): string {
    return `${chainId}:${address.toLowerCase()}:${clientWorkId}`;
  }

  async getWorkCompletion(
    address: string,
    chainId: number,
    clientWorkId: string
  ): Promise<WorkCompletion | undefined> {
    const db = await this.init();
    return db.get("work_completions", this.workScope(address, chainId, clientWorkId));
  }

  async acquireExecutionClaim(ids: string[], token: string): Promise<boolean> {
    const db = await this.init();
    const tx = db.transaction("execution_claims", "readwrite");
    const now = Date.now();
    const claims = await Promise.all(ids.map((id) => tx.store.get(id)));
    if (claims.some((claim) => claim && claim.token !== token && claim.expiresAt > now)) {
      await tx.done;
      return false;
    }
    for (const id of ids) await tx.store.put({ id, token, expiresAt: now + 60_000 });
    await tx.done;
    return true;
  }

  async renewExecutionClaim(ids: string[], token: string): Promise<boolean> {
    const db = await this.init();
    const tx = db.transaction("execution_claims", "readwrite");
    const claims = await Promise.all(ids.map((id) => tx.store.get(id)));
    if (claims.some((claim) => claim?.token !== token)) {
      await tx.done;
      return false;
    }
    for (const id of ids) await tx.store.put({ id, token, expiresAt: Date.now() + 60_000 });
    await tx.done;
    return true;
  }

  async releaseExecutionClaim(ids: string[], token: string): Promise<void> {
    const db = await this.init();
    const tx = db.transaction("execution_claims", "readwrite");
    for (const id of ids) if ((await tx.store.get(id))?.token === token) await tx.store.delete(id);
    await tx.done;
  }

  async getAttestationIdByClientWorkId(clientWorkId: string): Promise<string | null> {
    const db = await this.init();
    const mapping = await db.get("client_work_id_mappings", clientWorkId);
    return mapping?.attestationId || null;
  }

  async isClientWorkIdUploaded(clientWorkId: string): Promise<boolean> {
    const attestationId = await this.getAttestationIdByClientWorkId(clientWorkId);
    return attestationId !== null;
  }

  async getAllUploadedClientWorkIds(): Promise<Set<string>> {
    const db = await this.init();
    const allMappings = await db.getAll("client_work_id_mappings");
    return new Set(allMappings.map((m) => m.clientWorkId));
  }

  async storeClientCommitmentIdMapping(
    clientCommitmentId: string,
    commitmentId: bigint,
    jobId: string,
    chainId: number
  ): Promise<void> {
    const db = await this.init();
    await db.put("client_commitment_id_mappings", {
      clientCommitmentId,
      commitmentId: commitmentId.toString(),
      jobId,
      chainId,
      createdAt: Date.now(),
    });
  }

  async getCommitmentIdByClientId(clientCommitmentId: string): Promise<bigint | null> {
    const db = await this.init();
    const mapping = await db.get("client_commitment_id_mappings", clientCommitmentId);
    return mapping ? BigInt(mapping.commitmentId) : null;
  }

  async storeClientSeriesIdMapping(
    clientSeriesId: string,
    seriesId: bigint,
    jobId: string,
    chainId: number
  ): Promise<void> {
    const db = await this.init();
    await db.put("client_series_id_mappings", {
      clientSeriesId,
      seriesId: seriesId.toString(),
      jobId,
      chainId,
      createdAt: Date.now(),
    });
  }

  async getSeriesIdByClientId(clientSeriesId: string): Promise<bigint | null> {
    const db = await this.init();
    const mapping = await db.get("client_series_id_mappings", clientSeriesId);
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

export const jobQueueDB = new JobQueueDatabase();
