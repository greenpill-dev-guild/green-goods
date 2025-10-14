// Re-export types from permissionless for convenience
// Use permissionless SmartAccountClient directly - no custom wrapper needed
export type { SmartAccountClient } from "permissionless";

// Re-export global job types for convenience
// The actual types are defined globally in types/job-queue.d.ts
export type WorkJobPayload = globalThis.WorkJobPayload;
export type ApprovalJobPayload = globalThis.ApprovalJobPayload;

export interface JobProcessorResult {
  success: boolean;
  txHash?: string;
  error?: string;
}
