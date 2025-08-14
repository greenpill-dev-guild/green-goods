/**
 * Smart Account and Blockchain Types
 * Proper interfaces to replace 'unknown' and 'any' types
 */

// Smart Account Client interface
export interface SmartAccountClient {
  sendTransaction(params: TransactionParams): Promise<string>;
  getAddress(): Promise<string>;
  isConnected(): boolean;
  // Add other methods as needed
}

// Transaction parameters
export interface TransactionParams {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  gasLimit?: bigint;
  gasPrice?: bigint;
}

// Transaction result
export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: bigint;
  status: "success" | "failed" | "pending";
}

// EAS Configuration interface
export interface EASConfig {
  EAS: {
    address: string;
  };
  WORK: {
    uid: string;
  };
  WORK_APPROVAL: {
    uid: string;
  };
}

// Encoded data interfaces for processors
export interface EncodedWorkData {
  attestationData: `0x${string}`;
  easConfig: EASConfig;
  gardenAddress: string;
  actionTitle: string;
}

export interface EncodedApprovalData {
  attestationData: `0x${string}`;
  easConfig: EASConfig;
  gardenerAddress: string;
}

// Job execution context
export interface JobExecutionContext {
  chainId: number;
  smartAccountClient: SmartAccountClient;
  meta: Record<string, unknown>;
}

// Job processor result
export interface JobProcessorResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
  blockNumber?: number;
}

// Enhanced job processor interface with better typing
export interface TypedJobProcessor<TPayload = unknown, TEncoded = unknown> {
  encodePayload(payload: TPayload, chainId: number): Promise<TEncoded>;
  execute(encoded: TEncoded, context: JobExecutionContext): Promise<string>;
  validate?(payload: TPayload): boolean;
}

// Work-specific types
export interface WorkJobPayload {
  title?: string;
  feedback: string;
  metadata?: string;
  plantSelection: string[];
  plantCount: number;
  actionUID: number;
  gardenAddress: string;
  media?: File[];
}

export interface ApprovalJobPayload {
  actionUID: number;
  workUID: string;
  gardenerAddress: string;
  approved: boolean;
  feedback?: string;
}

// Enhanced job interface with better typing
export interface TypedJob<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  meta: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  synced: boolean;
  chainId: number;
}

// Queue statistics with additional metadata
export interface EnhancedQueueStats {
  total: number;
  pending: number;
  failed: number;
  synced: number;
  processing: number;
  lastSyncTime?: number;
  avgProcessingTime?: number;
}

// Network status interface
export interface NetworkStatus {
  isOnline: boolean;
  chainId?: number;
  blockNumber?: number;
  lastChecked: number;
}

// Sync result with detailed information
export interface DetailedSyncResult {
  processed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: Array<{
    jobId: string;
    error: string;
    attempts: number;
  }>;
  successful: Array<{
    jobId: string;
    txHash: string;
    gasUsed?: bigint;
  }>;
}

// Configuration interface for job queue
export interface JobQueueConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
  debounceMs: number;
  enableTelemetry: boolean;
}

// Media resource interface
export interface MediaResource {
  id: string;
  url: string;
  file: File;
  size: number;
  type: string;
  createdAt: number;
}

// Event payload types for better event typing
export interface JobEventPayloads {
  "job:added": { jobId: string; job: TypedJob };
  "job:processing": { jobId: string; job: TypedJob };
  "job:completed": { jobId: string; job: TypedJob; txHash: string };
  "job:failed": { jobId: string; job: TypedJob; error: string };
  "job:retrying": { jobId: string; job: TypedJob; attempt: number };
  "queue:sync-started": { jobCount: number };
  "queue:sync-completed": { result: DetailedSyncResult };
  "queue:sync-failed": { error: string; jobCount: number };
  "offline:status-changed": { status: NetworkStatus };
}
