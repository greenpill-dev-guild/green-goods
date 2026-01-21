/**
 * Job Queue Types
 *
 * Type definitions for the offline job queue system.
 * Import these explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { Job, JobProcessor, WorkJobPayload } from '@green-goods/shared';
 * ```
 */

import type { SmartAccountClient } from "permissionless";

// ============================================
// Core Job Types
// ============================================

export interface Job<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  meta?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  synced: boolean;
  chainId?: number;
  /** User address (smart account or wallet) that created this job */
  userAddress: string;
}

export interface QueueEvent {
  type: "job_added" | "job_processing" | "job_completed" | "job_failed";
  jobId: string;
  job?: Job;
  error?: string;
  txHash?: string;
}

export interface JobProcessor<TPayload = unknown, TEncoded = unknown> {
  encodePayload: (payload: TPayload, chainId: number) => Promise<TEncoded>;
  execute: (
    encoded: TEncoded,
    meta: Record<string, unknown>,
    smartAccountClient: SmartAccountClient
  ) => Promise<string>;
}

// ============================================
// Specific Job Payload Types
// ============================================

export interface WorkJobPayload {
  title?: string;
  feedback: string;
  metadata?: Record<string, unknown>;
  plantSelection: string[];
  plantCount: number;
  actionUID: number;
  gardenAddress: string;
  media?: File[];
}

export interface ApprovalJobPayload {
  actionUID: number;
  workUID: string;
  gardenAddress: string;
  gardenerAddress: string;
  approved: boolean;
  feedback?: string;
}

// ============================================
// Job Kind Mapping
// ============================================

export interface JobKindMap {
  work: WorkJobPayload;
  approval: ApprovalJobPayload;
}

export type JobKind = keyof JobKindMap;
export type JobPayload<K extends JobKind = JobKind> = JobKindMap[K];

// ============================================
// Queue Management Types
// ============================================

export type QueueSubscriber = (event: QueueEvent) => void;

export interface QueueStats {
  total: number;
  pending: number;
  failed: number;
  synced: number;
}

// ============================================
// Database Schema Types
// ============================================

/**
 * Serialized file data for IndexedDB storage.
 * iOS Safari cannot store File objects directly in IndexedDB due to
 * structured cloning limitations. We store the raw data and metadata
 * separately, then reconstruct the File when reading.
 */
export interface SerializedFileData {
  /** Raw file bytes as ArrayBuffer (IndexedDB-safe) */
  data: ArrayBuffer;
  /** Original filename */
  name: string;
  /** MIME type */
  type: string;
  /** Last modified timestamp */
  lastModified: number;
}

export interface JobQueueDBImage {
  id: string;
  jobId: string;
  /**
   * Serialized file data. We store as SerializedFileData instead of File
   * because iOS Safari fails to clone File objects to IndexedDB.
   * @see https://bugs.webkit.org/show_bug.cgi?id=228005
   */
  fileData: SerializedFileData;
  url: string;
  createdAt: number;
  /**
   * @deprecated Use fileData instead. Kept for migration compatibility.
   */
  file?: File;
}

export interface CachedWork {
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

// ============================================
// Draft Types
// ============================================

export type DraftStep = "intro" | "media" | "details" | "review";

/**
 * Persisted work draft state in IndexedDB.
 * Tracks multi-step form progress with resume capability.
 *
 * This is different from WorkSubmission (domain.ts) which is the
 * final form data submitted to the blockchain. WorkDraftRecord
 * includes persistence metadata (id, timestamps, step tracking).
 *
 * @example
 * ```typescript
 * const draft: WorkDraftRecord = {
 *   id: "draft-123",
 *   userAddress: "0x...",
 *   chainId: 84532,
 *   gardenAddress: "0x...",
 *   actionUID: 1,
 *   feedback: "In progress...",
 *   plantSelection: ["tomato"],
 *   plantCount: 5,
 *   currentStep: "details",
 *   firstIncompleteStep: "details",
 *   createdAt: 1704067200000,
 *   updatedAt: 1704067200000
 * };
 * ```
 *
 * @see WorkSubmission for the form input shape (what gets submitted)
 * @see DraftStep for valid step values
 */
export interface WorkDraftRecord {
  id: string;
  userAddress: string;
  chainId: number;
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount: number | undefined;
  /** Time spent on the work in minutes */
  timeSpentMinutes?: number;
  /** Current step in the flow (for resume) */
  currentStep: DraftStep;
  /** First incomplete step (computed on save) */
  firstIncompleteStep: DraftStep;
  createdAt: number;
  updatedAt: number;
}

/**
 * @deprecated Use WorkDraftRecord instead. Kept for backward compatibility.
 */
export type WorkDraft = WorkDraftRecord;

export interface DraftImage {
  id: string;
  draftId: string;
  /**
   * Serialized file data. We store as SerializedFileData instead of File
   * because iOS Safari fails to clone File objects to IndexedDB.
   */
  fileData: SerializedFileData;
  url: string;
  createdAt: number;
  /**
   * @deprecated Use fileData instead. Kept for migration compatibility.
   */
  file?: File;
}
