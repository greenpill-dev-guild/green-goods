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

export interface JobQueueDBImage {
  id: string;
  jobId: string;
  file: File;
  url: string;
  createdAt: number;
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

export interface WorkDraft {
  id: string;
  userAddress: string;
  chainId: number;
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount: number | undefined;
  /** Current step in the flow (for resume) */
  currentStep: DraftStep;
  /** First incomplete step (computed on save) */
  firstIncompleteStep: DraftStep;
  createdAt: number;
  updatedAt: number;
}

export interface DraftImage {
  id: string;
  draftId: string;
  file: File;
  url: string;
  createdAt: number;
}
