import { type IDBPDatabase, openDB } from "idb";
import { normalizeToFile } from "../../utils/app/normalizeToFile";
import { mediaResourceManager } from "./media-resource-manager";

const DB_NAME = "green-goods-job-queue";
const DB_VERSION = 5; // Incremented for userAddress field

interface ClientWorkIdMapping {
  clientWorkId: string;
  attestationId: string; // EAS attestation ID
  jobId: string; // Original job ID
  createdAt: number;
}

interface JobQueueDB {
  jobs: Job;
  job_images: JobQueueDBImage;
  cached_work: CachedWork;
  client_work_id_mappings: ClientWorkIdMapping;
}

class JobQueueDatabase {
  private db: IDBPDatabase<JobQueueDB> | null = null;

  async init(): Promise<IDBPDatabase<JobQueueDB>> {
    if (this.db) return this.db;

    this.db = await openDB<JobQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Create jobs store
        if (!db.objectStoreNames.contains("jobs")) {
          const jobsStore = db.createObjectStore("jobs", { keyPath: "id" });
          jobsStore.createIndex("kind", "kind");
          jobsStore.createIndex("synced", "synced");
          jobsStore.createIndex("createdAt", "createdAt");
          jobsStore.createIndex("attempts", "attempts");
          // Add compound index for better query performance
          jobsStore.createIndex("kind_synced", ["kind", "synced"]);
          // Add userAddress index for user-scoped queries
          jobsStore.createIndex("userAddress", "userAddress");
        }

        // Create job images store
        if (!db.objectStoreNames.contains("job_images")) {
          const imagesStore = db.createObjectStore("job_images", { keyPath: "id" });
          imagesStore.createIndex("jobId", "jobId");
          imagesStore.createIndex("createdAt", "createdAt");
        }

        // Keep cached work for backward compatibility
        if (!db.objectStoreNames.contains("cached_work")) {
          const cachedWorkStore = db.createObjectStore("cached_work", { keyPath: "id" });
          cachedWorkStore.createIndex("gardenAddress", "gardenAddress");
          cachedWorkStore.createIndex("gardenerAddress", "gardenerAddress");
        }

        // Create client work ID mappings store for fast deduplication
        if (!db.objectStoreNames.contains("client_work_id_mappings")) {
          const mappingsStore = db.createObjectStore("client_work_id_mappings", {
            keyPath: "clientWorkId",
          });
          mappingsStore.createIndex("attestationId", "attestationId");
          mappingsStore.createIndex("jobId", "jobId");
          mappingsStore.createIndex("createdAt", "createdAt");
        }

        // Migration: Add userAddress index to existing jobs store (v4 -> v5)
        if (oldVersion >= 1 && oldVersion < 5) {
          const jobsStore = transaction.objectStore("jobs");
          // Add userAddress index if it doesn't exist
          if (!jobsStore.indexNames.contains("userAddress")) {
            jobsStore.createIndex("userAddress", "userAddress");
          }
        }
      },
    });

    // Clean up stale URLs on init
    this.cleanupStaleUrls();

    return this.db;
  }

  /**
   * Clean up stale object URLs that are older than 1 hour
   */
  private async cleanupStaleUrls(): Promise<void> {
    try {
      const db = await this.init();
      const tx = db.transaction("job_images", "readwrite");
      const store = tx.objectStore("job_images");
      const index = store.index("createdAt");

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const staleImages = await index.getAll(IDBKeyRange.upperBound(oneHourAgo));

      for (const image of staleImages) {
        // Clean up the URL using MediaResourceManager
        mediaResourceManager.cleanupUrl(image.url);
        await store.delete(image.id);
      }

      await tx.done;
    } catch {
      // Silently handle cleanup errors
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
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const jobData: Job<T> = {
      ...job,
      id,
      createdAt: timestamp,
      attempts: 0,
      synced: false,
    } as Job<T>;

    // Normalize media up-front so we never persist a job partially.
    const normalizedMediaFiles: File[] = [];

    // Store images separately if present in payload
    if (job.payload && typeof job.payload === "object" && "media" in job.payload) {
      const media = (job.payload as { media?: File[] }).media;
      if (Array.isArray(media)) {
        for (let index = 0; index < media.length; index++) {
          const input = media[index] as unknown;
          const file = normalizeToFile(input, { fallbackName: `work-${id}-${index}.jpg` });

          if (!file) {
            // Avoid silently dropping images — it's better to fail fast than
            // attest partially. This also keeps on-chain "media" consistent
            // with what the user selected.
            throw new Error(`Invalid work media at index ${index}`);
          }

          normalizedMediaFiles.push(file);
        }
      }
    }

    // Atomically persist job + images.
    // If anything fails, we cleanup any created object URLs and nothing is committed.
    const tx = db.transaction(["jobs", "job_images"], "readwrite");
    try {
      await tx.objectStore("jobs").add(jobData as Job);

      for (let index = 0; index < normalizedMediaFiles.length; index++) {
        const file = normalizedMediaFiles[index];
        const imageId = crypto.randomUUID();
        const url = mediaResourceManager.createUrl(file, id);

        await tx.objectStore("job_images").add({
          id: imageId,
          jobId: id,
          file,
          url,
          createdAt: timestamp,
        });
      }

      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {}

      // Ensure we don't leak object URLs for a job that never persisted.
      mediaResourceManager.cleanupUrls(id);
      throw error;
    }

    return id;
  }

  /**
   * Get jobs filtered by user address (required) and optional additional filters.
   * @param filter.userAddress - Required user address to scope jobs
   * @param filter.kind - Optional job kind filter
   * @param filter.synced - Optional synced status filter
   */
  async getJobs(filter: { userAddress: string; kind?: string; synced?: boolean }): Promise<Job[]> {
    if (!filter.userAddress) {
      throw new Error("userAddress is required when getting jobs");
    }

    const db = await this.init();

    // Use userAddress index and filter additional criteria in memory
    // This is more compatible with fake-indexeddb used in tests
    const tx = db.transaction("jobs", "readonly");
    const index = tx.objectStore("jobs").index("userAddress");
    let result: Job[] = await index.getAll(filter.userAddress);

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

  async updateJob(job: Job): Promise<void> {
    const db = await this.init();
    await db.put("jobs", job);
  }

  async markJobSynced(id: string, txHash?: string): Promise<void> {
    const db = await this.init();
    const job = await db.get("jobs", id);

    if (job) {
      job.synced = true;
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

  async getImagesForJob(jobId: string): Promise<Array<{ id: string; file: File; url: string }>> {
    const db = await this.init();
    const tx = db.transaction("job_images", "readonly");
    const index = tx.objectStore("job_images").index("jobId");
    const images = await index.getAll(jobId);

    // Normalize files: IndexedDB may strip File metadata, so reconstruct if needed
    const result = images.map((img) => {
      const normalizedFile =
        img.file instanceof File
          ? img.file
          : new File([img.file], img.file?.name || `work-${jobId}-${img.id}.jpg`, {
              type: (img.file as Blob)?.type || "image/jpeg",
              lastModified: Date.now(),
            });

      return {
        id: img.id,
        file: normalizedFile,
        url: mediaResourceManager.getOrCreateUrl(normalizedFile, jobId),
      };
    });

    return result;
  }

  /**
   * Create a fresh object URL for a file (use for immediate consumption)
   */
  createFreshImageUrl(file: File): string {
    return mediaResourceManager.createUrl(file);
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

  /**
   * Clear synced jobs for a specific user.
   * @param userAddress - Required user address to scope deletion
   */
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

  /**
   * Get job statistics for a specific user.
   * @param userAddress - Required user address to scope statistics
   */
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
      failed: userJobs.filter((job) => job.lastError).length,
      synced: userJobs.filter((job) => job.synced).length,
    };
  }

  /**
   * Store clientWorkId -> attestationId mapping for fast deduplication
   */
  async storeClientWorkIdMapping(
    clientWorkId: string,
    attestationId: string,
    jobId: string
  ): Promise<void> {
    const db = await this.init();
    await db.put("client_work_id_mappings", {
      clientWorkId,
      attestationId,
      jobId,
      createdAt: Date.now(),
    });
  }

  /**
   * Get attestation ID for a clientWorkId (instant lookup, no IPFS fetch)
   */
  async getAttestationIdByClientWorkId(clientWorkId: string): Promise<string | null> {
    const db = await this.init();
    const mapping = await db.get("client_work_id_mappings", clientWorkId);
    return mapping?.attestationId || null;
  }

  /**
   * Check if a clientWorkId has been uploaded (fast local check)
   */
  async isClientWorkIdUploaded(clientWorkId: string): Promise<boolean> {
    const attestationId = await this.getAttestationIdByClientWorkId(clientWorkId);
    return attestationId !== null;
  }

  /**
   * Get all uploaded clientWorkIds for batch deduplication
   */
  async getAllUploadedClientWorkIds(): Promise<Set<string>> {
    const db = await this.init();
    const allMappings = await db.getAll("client_work_id_mappings");
    return new Set(allMappings.map((m) => m.clientWorkId));
  }

  /**
   * Cleanup old mappings (older than 30 days)
   */
  async cleanupOldMappings(): Promise<void> {
    const db = await this.init();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const tx = db.transaction("client_work_id_mappings", "readwrite");
    const index = tx.objectStore("client_work_id_mappings").index("createdAt");
    const oldMappings = await index.getAll(IDBKeyRange.upperBound(thirtyDaysAgo));

    for (const mapping of oldMappings) {
      await tx.objectStore("client_work_id_mappings").delete(mapping.clientWorkId);
    }

    await tx.done;
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
}

export const jobQueueDB = new JobQueueDatabase();
