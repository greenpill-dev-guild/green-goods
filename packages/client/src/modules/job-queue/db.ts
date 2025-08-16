import { type IDBPDatabase, openDB } from "idb";
import { mediaResourceManager } from "./media-resource-manager";

const DB_NAME = "green-goods-job-queue";
const DB_VERSION = 2;

interface JobQueueDB {
  jobs: Job;
  job_images: JobQueueDBImage;
  cached_work: CachedWork;
}

class JobQueueDatabase {
  private db: IDBPDatabase<JobQueueDB> | null = null;

  async init(): Promise<IDBPDatabase<JobQueueDB>> {
    if (this.db) return this.db;

    this.db = await openDB<JobQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Create jobs store
        if (!db.objectStoreNames.contains("jobs")) {
          const jobsStore = db.createObjectStore("jobs", { keyPath: "id" });
          jobsStore.createIndex("kind", "kind");
          jobsStore.createIndex("synced", "synced");
          jobsStore.createIndex("createdAt", "createdAt");
          jobsStore.createIndex("attempts", "attempts");
          // Add compound index for better query performance
          jobsStore.createIndex("kind_synced", ["kind", "synced"]);
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

        // Migration from old offline-db schema
        if (oldVersion === 1) {
          // If upgrading from v1, we'll handle migration separately
          // Silently migrate without logging
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

    await db.add("jobs", jobData as Job);

    // Store images separately if present in payload
    if (job.payload && typeof job.payload === "object" && "media" in job.payload) {
      const media = (job.payload as { media?: File[] }).media;
      if (Array.isArray(media)) {
        for (const file of media) {
          if (file instanceof File) {
            const imageId = crypto.randomUUID();
            const url = mediaResourceManager.createUrl(file, id);

            await db.add("job_images", {
              id: imageId,
              jobId: id,
              file,
              url,
              createdAt: timestamp,
            });
          }
        }
      }
    }

    return id;
  }

  async getJobs(filter?: { kind?: string; synced?: boolean }): Promise<Job[]> {
    const db = await this.init();

    if (filter?.kind && filter?.synced !== undefined) {
      const tx = db.transaction("jobs", "readonly");
      const index = tx.objectStore("jobs").index("kind_synced");
      // Store boolean as integer in composite key to satisfy IDBValidKey
      const syncedKey = filter.synced ? 1 : 0;
      return await index.getAll([filter.kind, syncedKey] as unknown as IDBValidKey);
    }

    if (filter?.kind) {
      const tx = db.transaction("jobs", "readonly");
      const index = tx.objectStore("jobs").index("kind");
      return await index.getAll(filter.kind);
    }

    if (filter?.synced !== undefined) {
      // IndexedDB doesn't support boolean indexes directly, so we get all and filter
      const allJobs = await db.getAll("jobs");
      return allJobs.filter((job) => job.synced === filter.synced);
    }

    return db.getAll("jobs");
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
      await db.put("jobs", job);
    }
  }

  async getImagesForJob(jobId: string): Promise<Array<{ id: string; file: File; url: string }>> {
    const db = await this.init();
    const tx = db.transaction("job_images", "readonly");
    const index = tx.objectStore("job_images").index("jobId");
    const images = await index.getAll(jobId);

    // Always create fresh object URLs on access (stored URLs may be stale across reloads)
    return images.map((img) => ({
      id: img.id,
      file: img.file,
      url: mediaResourceManager.createUrl(img.file, jobId),
    }));
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

  async clearSyncedJobs(): Promise<void> {
    await this.init();
    const syncedJobs = await this.getJobs({ synced: true });

    for (const job of syncedJobs) {
      await this.deleteJob(job.id);
    }
  }

  async getStats(): Promise<{ total: number; pending: number; failed: number; synced: number }> {
    const db = await this.init();
    const allJobs = await db.getAll("jobs");

    return {
      total: allJobs.length,
      pending: allJobs.filter((job) => !job.synced && !job.lastError).length,
      failed: allJobs.filter((job) => job.lastError).length,
      synced: allJobs.filter((job) => job.synced).length,
    };
  }

  /**
   * Cleanup all resources when database is no longer needed
   */
  async cleanup(): Promise<void> {
    // Cleanup all URLs managed by MediaResourceManager
    mediaResourceManager.cleanupAll();

    // Cleanup stale URLs in database
    await this.cleanupStaleUrls();
  }
}

export const jobQueueDB = new JobQueueDatabase();
