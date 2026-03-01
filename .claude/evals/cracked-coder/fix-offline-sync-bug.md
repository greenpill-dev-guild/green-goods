# Eval Task: Fix Offline Sync Bug — Stale Service Worker Cache Causes Silent Job Failures

## Brief

The job queue's `processJob()` function silently drops work submissions when the service worker cache holds stale schema UIDs. The job status is set to `synced: true` even though the EAS attestation was never created, because the error from the resolver (schema UID mismatch) is caught and swallowed in the retry path.

## Synthetic Code (paste into `packages/shared/src/modules/job-queue/sync-processor.ts` before running eval)

```typescript
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface SyncContext {
  chainId: number;
  schemaUIDs: Record<string, string>;
}

/**
 * Processes a single pending job from the queue.
 * BUG: When the cached schemaUIDs are stale (e.g., after a contract redeployment),
 * the EAS attestation call reverts with "SchemaNotFound". The catch block below
 * marks the job as synced (success) instead of failed, because the error check
 * only handles network-class errors and falls through to the success path for
 * unknown error types.
 */
export async function processPendingJob(
  jobId: string,
  context: SyncContext
): Promise<{ success: boolean; txHash?: string }> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job || job.synced) {
    return { success: true };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const schemaUID = context.schemaUIDs[job.kind];
      if (!schemaUID) {
        throw new Error(`No schema UID found for job kind: ${job.kind}`);
      }

      const txHash = await submitToEAS(job, schemaUID, context.chainId);

      // Mark as synced
      await jobQueueDB.updateJob(jobId, { synced: true, txHash });
      jobQueueEventBus.emit("job:synced", { jobId, txHash });

      return { success: true, txHash };
    } catch (error) {
      lastError = error;

      // BUG: Only checks for network errors. Contract reverts (like SchemaNotFound)
      // fall through without being classified, and the job ends up marked as synced
      // after the retry loop exits because `lastError` is set but never re-thrown.
      if (isNetworkError(error)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-network errors: log but don't retry
      logger.warn("Job processing encountered non-network error", {
        jobId,
        attempt,
        error,
      });
    }
  }

  // BUG: Falls through here after exhausting retries OR after a non-network error.
  // Should mark the job as FAILED, but instead returns success: true because
  // the code only returns { success: false } when the job doesn't exist.
  // The caller then marks the job as synced.
  await jobQueueDB.updateJob(jobId, { synced: true });
  jobQueueEventBus.emit("job:synced", { jobId });
  return { success: true };
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch failed") ||
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED")
    );
  }
  return false;
}

async function submitToEAS(
  job: Job,
  schemaUID: string,
  chainId: number
): Promise<string> {
  // Simulated — real implementation calls EAS SDK
  throw new Error("Not implemented in synthetic code");
}
```

## Bug Description

Two interrelated bugs in the sync processor:

1. **Error classification gap**: The retry logic only checks for `isNetworkError()`. Contract-level reverts (e.g., `SchemaNotFound`, `InvalidSchema`, resolver reverts) are caught by the generic catch block but not classified as fatal errors. They get logged at `warn` level but processing continues.

2. **Silent success on failure**: After the retry loop exits (either by exhausting retries or encountering a non-network error), the code unconditionally marks the job as `synced: true` and returns `{ success: true }`. The job appears successful to the UI and is never retried, even though no attestation was created.

## Requirements

1. Add a `isContractError()` classifier that identifies EAS/resolver reverts (SchemaNotFound, InvalidSchema, resolver revert patterns)
2. After the retry loop, if `lastError` is set, mark the job as **failed** (not synced) with the error message stored in the job record
3. Return `{ success: false }` when the job fails, and emit `job:failed` event instead of `job:synced`
4. Add a `failedReason` field to the job update for debugging
5. Ensure network errors still retry with exponential backoff (existing behavior preserved)
6. Contract errors should NOT retry (they are deterministic failures)
7. Write tests that cover:
   - Network error triggers retry with backoff
   - Contract error does NOT retry, marks job as failed
   - Unknown errors do NOT mark job as synced
   - Successful submission marks job as synced with txHash

## Constraints Under Test

- **Error Handling Pattern**: Must use `categorizeError()` or equivalent classification (not just string matching)
- **No Silent Failures**: Job must NEVER be marked as `synced: true` unless a real txHash was obtained
- **Event Bus Correctness**: `job:synced` only on success, `job:failed` on failure
- **No console.log**: Use `logger` from shared (Rule #12)
- **TDD**: Failing tests must be written before the fix is implemented
- **Retry Preservation**: Network error retry logic with exponential backoff must remain functional

## Expected Artifacts

- Fixed `packages/shared/src/modules/job-queue/sync-processor.ts`
- `packages/shared/src/modules/job-queue/__tests__/sync-processor.test.ts`

## Common Failure Modes

- Agent fixes the success path but forgets to handle the case where `lastError` is set after retries exhaust
- Agent adds contract error classification but still falls through to the `synced: true` path
- Agent marks ALL errors as fatal (breaking the network retry behavior)
- Agent writes tests that only cover the happy path, not the three error categories
- Agent uses `console.error` instead of `logger.error` in the fix
