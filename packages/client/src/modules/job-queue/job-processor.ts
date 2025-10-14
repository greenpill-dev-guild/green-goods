import { track } from "@/modules/app/posthog";
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
  private clientProvider: (() => SmartAccountClient | null) | null = null;

  /**
   * Set the smart account client for blockchain transactions
   */
  setSmartAccountClient(client: SmartAccountClient | null): void {
    this.smartAccountClient = client;
    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      // eslint-disable-next-line no-console
      console.debug("[JobProcessor] setSmartAccountClient", {
        hasClient: !!client,
      });
    }
  }

  /**
   * Set a provider function that can supply the latest smart account client on demand
   */
  setSmartAccountClientProvider(provider: (() => SmartAccountClient | null) | null): void {
    this.clientProvider = provider;
  }

  /**
   * Whether a smart account client is available for immediate processing
   */
  hasClient(): boolean {
    if (this.smartAccountClient) return true;
    if (this.clientProvider) {
      const fresh = this.clientProvider();
      if (fresh) {
        this.smartAccountClient = fresh;
        return true;
      }
    }
    return false;
  }

  /**
   * Process a single job with error handling and retry logic
   */
  async processJob(jobId: string): Promise<JobProcessorResult> {
    const job = await jobQueueDB.getJob(jobId);
    // Idempotency: if job is missing or already synced, treat as a no-op success
    if (!job || job.synced) {
      return { success: true };
    }

    if (!this.smartAccountClient) {
      // Attempt to fetch a fresh client from provider
      if (this.clientProvider) {
        const fresh = this.clientProvider();
        if (fresh) {
          this.smartAccountClient = fresh;
        }
      }
    }
    if (!this.smartAccountClient) {
      console.error("[JobProcessor] Smart account client not available");
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
        if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
          // eslint-disable-next-line no-console
          console.debug("[JobProcessor] encoding work payload", {
            jobId,
            chainId,
            imageCount: images.length,
          });
        }
        const encoded = await workProcessor.encodePayload(workPayload, chainId);
        if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
          // eslint-disable-next-line no-console
          console.debug("[JobProcessor] executing work transaction", {
            jobId,
            to: (encoded as any)?.easConfig?.EAS?.address,
          });
        }
        txHash = await workProcessor.execute(encoded, job.meta || {}, this.smartAccountClient);
      } else if (job.kind === "approval") {
        if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
          // eslint-disable-next-line no-console
          console.debug("[JobProcessor] encoding approval payload", { jobId, chainId });
        }
        const encoded = await approvalProcessor.encodePayload(
          job.payload as ApprovalJobPayload,
          chainId
        );
        if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
          // eslint-disable-next-line no-console
          console.debug("[JobProcessor] executing approval transaction", {
            jobId,
            to: (encoded as any)?.easConfig?.EAS?.address,
          });
        }
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
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[JobProcessor] processJob error", { jobId, error: errorMessage });
      }

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

    console.log("[JobProcessor] Processing batch", { jobs, batchSize });

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
