import Dexie, { type EntityTable } from "dexie";
import type { CachedWork, Job, JobQueueDBImage } from "../../types/job-queue";

export const JOB_QUEUE_DB_NAME = "green-goods-job-queue";

export interface WorkCompletion {
  scope: string;
  clientWorkId: string;
  userAddress: string;
  chainId: number;
  transactionHash: string;
  jobId: string;
  createdAt: number;
}

export interface ClientWorkIdMapping {
  clientWorkId: string;
  attestationId: string; // EAS attestation ID
  jobId: string; // Original job ID
  createdAt: number;
}

export interface ClientCommitmentIdMapping {
  clientCommitmentId: string;
  commitmentId: string;
  jobId: string;
  chainId: number;
  createdAt: number;
}

export interface ClientSeriesIdMapping {
  clientSeriesId: string;
  seriesId: string;
  jobId: string;
  chainId: number;
  createdAt: number;
}

export interface ExecutionClaim {
  id: string;
  token: string;
  expiresAt: number;
}

/**
 * The queue's IndexedDB database as typed Dexie tables.
 *
 * The version history is the schema. Dexie stores a declared version ×10 in
 * IndexedDB, so version 8 opens the database earlier builds created with
 * `idb` at version 7 and upgrades it in place: every store and row is kept,
 * missing indexes are added and retired ones dropped. `synced` is a boolean,
 * which IndexedDB cannot index, so the old `synced` and `kind_synced`
 * indexes never held a row; `attempts` was never queried. Neither returns.
 */
export class JobQueueDatabase extends Dexie {
  jobs!: EntityTable<Job, "id">;
  job_images!: EntityTable<JobQueueDBImage, "id">;
  cached_work!: EntityTable<CachedWork, "id">;
  client_work_id_mappings!: EntityTable<ClientWorkIdMapping, "clientWorkId">;
  client_commitment_id_mappings!: EntityTable<ClientCommitmentIdMapping, "clientCommitmentId">;
  client_series_id_mappings!: EntityTable<ClientSeriesIdMapping, "clientSeriesId">;
  work_completions!: EntityTable<WorkCompletion, "scope">;
  execution_claims!: EntityTable<ExecutionClaim, "id">;

  constructor(name = JOB_QUEUE_DB_NAME) {
    super(name);
    this.version(8)
      .stores({
        jobs: "id, kind, createdAt, userAddress",
        job_images: "id, jobId, createdAt",
        cached_work: "id, gardenAddress, gardenerAddress",
        client_work_id_mappings: "clientWorkId, attestationId, jobId, createdAt",
        client_commitment_id_mappings: "clientCommitmentId, commitmentId, jobId, chainId",
        client_series_id_mappings: "clientSeriesId, seriesId, jobId, chainId",
        work_completions: "scope",
        execution_claims: "id",
      })
      // Rows written before version 7 kept the address as typed; every query keys on lowercase.
      .upgrade((tx) =>
        tx
          .table<Job>("jobs")
          .toCollection()
          .modify((job) => {
            job.userAddress = job.userAddress.toLowerCase() as Job["userAddress"];
          })
      );
  }
}
