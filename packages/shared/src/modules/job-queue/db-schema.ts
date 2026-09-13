import { type IDBPDatabase, openDB } from "idb";
import type { CachedWork, Job, JobQueueDBImage } from "../../types/job-queue";

const DB_NAME = "green-goods-job-queue";
const DB_VERSION = 7; // Scoped Work completion identities and cross-context execution claims

export interface WorkCompletion {
  scope: string;
  clientWorkId: string;
  userAddress: string;
  chainId: number;
  transactionHash: string;
  jobId: string;
  createdAt: number;
}

interface ClientWorkIdMapping {
  clientWorkId: string;
  attestationId: string; // EAS attestation ID
  jobId: string; // Original job ID
  createdAt: number;
}

interface ClientCommitmentIdMapping {
  clientCommitmentId: string;
  commitmentId: string;
  jobId: string;
  chainId: number;
  createdAt: number;
}

interface ClientSeriesIdMapping {
  clientSeriesId: string;
  seriesId: string;
  jobId: string;
  chainId: number;
  createdAt: number;
}

export interface JobQueueDB {
  work_completions: WorkCompletion;
  execution_claims: { id: string; token: string; expiresAt: number };
  jobs: Job;
  job_images: JobQueueDBImage;
  cached_work: CachedWork;
  client_work_id_mappings: ClientWorkIdMapping;
  client_commitment_id_mappings: ClientCommitmentIdMapping;
  client_series_id_mappings: ClientSeriesIdMapping;
}

export function openJobQueueDatabase(onClose: () => void): Promise<IDBPDatabase<JobQueueDB>> {
  return openDB<JobQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains("work_completions"))
        db.createObjectStore("work_completions", { keyPath: "scope" });
      if (!db.objectStoreNames.contains("execution_claims"))
        db.createObjectStore("execution_claims", { keyPath: "id" });
      if (oldVersion > 0 && oldVersion < 7) {
        void (async () => {
          let cursor = await transaction.objectStore("jobs").openCursor();
          while (cursor) {
            const job = cursor.value;
            job.userAddress = job.userAddress.toLowerCase() as Job["userAddress"];
            await cursor.update(job);
            cursor = await cursor.continue();
          }
        })();
      }
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

      if (!db.objectStoreNames.contains("client_commitment_id_mappings")) {
        const mappingsStore = db.createObjectStore("client_commitment_id_mappings", {
          keyPath: "clientCommitmentId",
        });
        mappingsStore.createIndex("commitmentId", "commitmentId");
        mappingsStore.createIndex("jobId", "jobId");
        mappingsStore.createIndex("chainId", "chainId");
      }

      if (!db.objectStoreNames.contains("client_series_id_mappings")) {
        const mappingsStore = db.createObjectStore("client_series_id_mappings", {
          keyPath: "clientSeriesId",
        });
        mappingsStore.createIndex("seriesId", "seriesId");
        mappingsStore.createIndex("jobId", "jobId");
        mappingsStore.createIndex("chainId", "chainId");
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
    blocking: () => {
      onClose();
    },
    terminated: () => {
      onClose();
    },
  });
}
