import { track } from "@/modules/posthog";
import type {
  ApprovalJobPayload,
  JobProcessorResult,
  SmartAccountClient,
  WorkJobPayload,
} from "@/types/smart-account";
import { jobQueueDB } from "./db";
import { approvalProcessor } from "./processors/approval";
import { workProcessor } from "./processors/work";

// Default chain ID helper
export function getDefaultChainId(work?: { chainId?: number }): number {
  return work?.chainId || 84532; // Base Sepolia
}

// Processors registry
const processors = {
  work: workProcessor,
  approval: approvalProcessor,
} as const;

/**
 * Handles job processing logic - single responsibility for executing jobs
 */
export class JobProcessor {
  private smartAccountClient: SmartAccountClient | null = null;

  /**
   * Set the smart account client for blockchain transactions
   */
  setSmartAccountClient(client: SmartAccountClient | null): void {
    this.smartAccountClient = client;
  }

  /**
   * Process a single job with error handling and retry logic
   */
  async processJob(jobId: string): Promise<JobProcessorResult> {
    const job = await jobQueueDB.getJob(jobId);
    if (!job || job.synced) {
      return { success: false, error: "Job not found or already synced" };
    }

    if (!this.smartAccountClient) {
      return { success: false, error: "Smart account client not available" };
    }

    const startTime = Date.now();

    try {
      const processor = processors[job.kind as keyof typeof processors];
      if (!processor) {
        throw new Error(
          `No processor found for job kind: ${job.kind}. ` +
            `Available processors: ${Object.keys(processors).join(", ")}`
        );
      }

      const chainId = job.chainId || getDefaultChainId();
      let txHash: string;

      // Handle different job types
      if (job.kind === "work") {
        // Get images for work jobs
        const images = await jobQueueDB.getImagesForJob(jobId);
        const workPayload = {
          ...(job.payload as WorkJobPayload),
          media: images.map((img: { file: File }) => img.file),
        };

        const encoded = await workProcessor.encodePayload(workPayload, chainId);
        txHash = await workProcessor.execute(encoded, job.meta || {}, this.smartAccountClient);
      } else if (job.kind === "approval") {
        const encoded = await approvalProcessor.encodePayload(
          job.payload as ApprovalJobPayload,
          chainId
        );
        txHash = await approvalProcessor.execute(encoded, job.meta || {}, this.smartAccountClient);
      } else {
        throw new Error(`Unsupported job kind: ${job.kind}`);
      }

      // Mark as synced
      await jobQueueDB.markJobSynced(jobId, txHash);

      const processingTime = Date.now() - startTime;

      // Track successful processing
      track("offline_job_processed", {
        job_id: jobId,
        job_kind: job.kind,
        processing_time_ms: processingTime,
        attempts: job.attempts + 1,
        tx_hash: txHash,
      });

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Track failed processing
      track("offline_job_failed", {
        job_id: jobId,
        job_kind: job.kind,
        error: errorMessage,
        attempts: job.attempts + 1,
        will_retry: job.attempts < 2,
      });

      await jobQueueDB.markJobFailed(jobId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process multiple jobs in batches
   */
  async processBatch(
    jobs: Job[],
    batchSize: number = 5
  ): Promise<{
    processed: number;
    failed: number;
    skipped: number;
  }> {
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Process in batches to avoid overwhelming the network
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (job: Job) => {
          if (job.lastError && job.attempts >= 3) {
            skipped++;
            return false; // Skip jobs that have failed too many times
          }
          const result = await this.processJob(job.id);
          return result.success;
        })
      );

      results.forEach((result: PromiseSettledResult<boolean>) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            processed++;
          } else {
            skipped++;
          }
        } else {
          failed++;
          track("job_batch_processing_failed", {
            reason: result.reason,
          });
        }
      });
    }

    return { processed, failed, skipped };
  }
}
