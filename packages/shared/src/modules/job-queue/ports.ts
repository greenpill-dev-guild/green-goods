import type {
  Job,
  JobKindMap,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../../types/job-queue";
import type { TransactionSender } from "../transactions/types";

export interface ProcessJobContext {
  transactionSender: TransactionSender | null;
}

export interface ProcessJobResult {
  success: boolean;
  txHash?: string;
  error?: string;
  skipped?: boolean;
}

export interface FlushContext extends ProcessJobContext {
  userAddress: string;
}

export interface FlushResult {
  processed: number;
  failed: number;
  skipped: number;
}

export interface JobQueueEventMap {
  "job:added": { jobId: string; job: Job };
  "job:processing": { jobId: string; job: Job };
  "job:completed": { jobId: string; job: Job; txHash: string };
  "job:failed": { jobId: string; job: Job; error: string };
  "queue:sync-completed": { result: FlushResult };
  "offline:status-changed": { isOnline: boolean };
  "background:sync-requested": { source: "service-worker"; timestamp: number };
}

export type JobQueueEventType = keyof JobQueueEventMap;

export interface JobQueueEvents {
  emit<T extends JobQueueEventType>(type: T, data: JobQueueEventMap[T]): void;
  on<T extends JobQueueEventType>(
    type: T,
    listener: (data: JobQueueEventMap[T]) => void
  ): () => void;
}

export interface JobQueueStore {
  addJob<T = unknown>(
    job: Omit<Job<T>, "id" | "createdAt" | "attempts" | "synced">
  ): Promise<string>;
  getJob(id: string): Promise<Job | undefined>;
  getJobs(filter: { userAddress: string; kind?: string; synced?: boolean }): Promise<Job[]>;
  updateJob(job: Job): Promise<void>;
  markJobSynced(id: string, txHash?: string): Promise<void>;
  markJobFailed(id: string, error: string): Promise<void>;
  markJobTerminalFailed(id: string, error: string): Promise<void>;
  deleteJob(id: string): Promise<void>;
  getImagesForJob(jobId: string): Promise<Array<{ id: string; file: File; url: string }>>;
  getStats(userAddress: string): Promise<QueueStats>;
  storeClientWorkIdMapping(
    clientWorkId: string,
    attestationId: string,
    jobId: string
  ): Promise<void>;
  loadFailedDeleteIds(): Promise<string[]>;
  saveFailedDeleteIds(ids: string[]): Promise<void>;
  cleanup(): Promise<void>;
}

export interface StorageQuotaSnapshot {
  used: number;
  quota: number;
  percentUsed: number;
  isLow: boolean;
  isCritical: boolean;
}

export interface JobQueueAnalytics {
  jobCreated(kind: string, isOnline: boolean, chainId: number): void;
  jobPermanentlyFailed(job: Job): void;
  jobProcessed(kind: string, processingTimeMs: number, attempts: number): void;
  jobProcessingError(
    job: Job,
    processingDuration: number,
    chainId: number,
    maxRetries: number
  ): Promise<void>;
  storageWarning(kind: string, quota: StorageQuotaSnapshot, isOnline: boolean): void;
  privateEvent(event: string, properties: Record<string, unknown>): void;
  processingStarted(kind: string, attempt: number): void;
}

export interface JobQueueLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface JobQueueClock {
  now(): number;
}

export interface JobQueueConnectivity {
  isOnline(): boolean;
}

export interface JobQueueBackgroundSync {
  request(): void;
}

export interface JobQueueQuota {
  get(): Promise<StorageQuotaSnapshot>;
}

export interface JobQueueScheduler {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  yield(): Promise<void>;
}

export type JobExecution =
  | { status: "complete"; txHash?: string }
  | { status: "submitted"; txHash: string }
  | { status: "waiting"; reason: string }
  | { status: "identity-conflict"; reason: string }
  | { status: "unavailable"; reason: string };

export interface JobExecutorRegistry {
  execute(
    jobId: string,
    job: Job,
    chainId: number,
    sender: TransactionSender
  ): Promise<JobExecution>;
}

export interface JobAdmission {
  prepare<K extends keyof JobKindMap>(input: {
    kind: K;
    payload: JobKindMap[K];
    chainId: number;
    userAddress: string;
  }): JobKindMap[K];
}

export interface JobQueueLifecycle {
  attach(cleanup: () => void): () => void;
}

export interface JobQueueConfig {
  defaultChainId: number;
  maxRetries: number;
  storageQuotaCacheTTL: number;
}

export interface JobQueueDependencies {
  store: JobQueueStore;
  events: JobQueueEvents;
  executors: JobExecutorRegistry;
  admission: JobAdmission;
  analytics: JobQueueAnalytics;
  quota: JobQueueQuota;
  scheduler: JobQueueScheduler;
  connectivity: JobQueueConnectivity;
  backgroundSync: JobQueueBackgroundSync;
  clock: JobQueueClock;
  config: JobQueueConfig;
  lifecycle: JobQueueLifecycle;
  logger: JobQueueLogger;
}

export interface JobQueueHandle {
  addJob<K extends keyof JobKindMap>(
    kind: K,
    payload: JobKindMap[K],
    userAddress: string,
    meta?: Record<string, unknown>
  ): Promise<string>;
  processJob(jobId: string, context: ProcessJobContext): Promise<ProcessJobResult>;
  flush(context: FlushContext): Promise<FlushResult>;
  retryJob(jobId: string): Promise<void>;
  discardJob(jobId: string): Promise<boolean>;
  getStats(userAddress: string): Promise<QueueStats>;
  getJobs(userAddress: string, filter?: { kind?: string; synced?: boolean }): Promise<Job[]>;
  getJobsWithImages(
    userAddress: string
  ): Promise<
    Array<{ job: Job<WorkJobPayload>; images: Array<{ id: string; file: File; url: string }> }>
  >;
  hasPendingJobs(userAddress: string): Promise<boolean>;
  getPendingCount(userAddress: string): Promise<number>;
  subscribe(listener: (event: QueueEvent) => void): () => void;
  onSyncCompleted(listener: (result: FlushResult) => void): () => void;
  onBackgroundSyncRequested(listener: () => void): () => void;
  cleanup(): Promise<void>;
}
