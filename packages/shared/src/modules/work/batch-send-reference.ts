import type { BatchReference } from "../transactions/batch-types";

// Keep the accepted ID even if the durable job checkpoint fails during this session.
const references = new Map<string, BatchReference>();
export function rememberBatchBroadcast(jobId: string, reference: BatchReference): void {
  references.set(jobId, reference);
}
export function retainedBatchBroadcast(jobId: string): BatchReference | undefined {
  return references.get(jobId);
}
export function forgetBatchBroadcast(jobId: string): void {
  references.delete(jobId);
}
