// Job Queue Types - Global declarations for better type safety

declare global {
  interface Job<T = unknown> {
    id: string;
    kind: string;
    payload: T;
    meta?: Record<string, unknown>;
    createdAt: number;
    attempts: number;
    lastError?: string;
    synced: boolean;
    chainId?: number;
  }

  interface QueueEvent {
    type: "job_added" | "job_processing" | "job_completed" | "job_failed" | "job_retrying";
    jobId: string;
    job?: Job;
    error?: string;
    txHash?: string;
  }

  interface JobProcessor<TPayload = unknown, TEncoded = unknown> {
    encodePayload: (payload: TPayload, chainId: number) => Promise<TEncoded>;
    execute: (
      encoded: TEncoded,
      meta: Record<string, unknown>,
      smartAccountClient: unknown
    ) => Promise<string>;
  }

  // Specific job payload types
  interface WorkJobPayload {
    title?: string;
    feedback: string;
    metadata?: string;
    plantSelection: string[];
    plantCount: number;
    actionUID: number;
    gardenAddress: string;
    media?: File[];
  }

  interface ApprovalJobPayload {
    actionUID: number;
    workUID: string;
    gardenerAddress: string;
    approved: boolean;
    feedback?: string;
  }

  // Map of job kinds to their payload types
  interface JobKindMap {
    work: WorkJobPayload;
    approval: ApprovalJobPayload;
  }

  type QueueSubscriber = (event: QueueEvent) => void;

  // Queue statistics interface
  interface QueueStats {
    total: number;
    pending: number;
    failed: number;
    synced: number;
  }

  // Database schema interfaces
  interface JobQueueDBImage {
    id: string;
    jobId: string;
    file: File;
    url: string;
    createdAt: number;
  }

  interface CachedWork {
    id: string;
    title: string;
    actionUID: number;
    gardenerAddress: string;
    gardenAddress: string;
    feedback: string;
    metadata: string;
    media: string[];
    createdAt: number;
    status?: "pending" | "approved" | "rejected";
  }

  // Utility types for better type safety
  type JobKind = keyof JobKindMap;
  type JobPayload<K extends JobKind = JobKind> = JobKindMap[K];
}

export {};
