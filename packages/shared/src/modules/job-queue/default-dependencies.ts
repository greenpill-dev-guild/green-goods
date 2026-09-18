import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getOntologyChainMaturity } from "../../ontology/query";
import { connectivityStore } from "../../stores/connectivity";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { scheduleTask, yieldToMain } from "../../utils/scheduler";
import { getStorageQuota } from "../../utils/storage/quota";
import { addBreadcrumb } from "../app/error-tracking";
import { logger } from "../app/logger";
import { SW_MESSAGE } from "../app/service-worker-protocol";
import { COMMITMENT_JOB_KINDS } from "../commitment-pooling/jobs";
import { createCommitmentQueueAdmission } from "../commitment-pooling/queue-admission";
import { selectCommitmentPoolingAvailability } from "../commitment-pooling/selectors";
import { StrandedSendReopened } from "../work/stranded-intent";
import { InvalidWorkAttachmentError, PendingHeicConversionError } from "../work/work-attachments";
import {
  AwaitingWorkConfirmation,
  isWorkSubmissionCancelled,
  WorkTransactionReverted,
} from "../work/work-confirmation";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import { createJobExecutorRegistry, type JobExecutor } from "./executor-registry";
import {
  trackJobCreated,
  trackJobPermanentlyFailed,
  trackJobProcessed,
  trackJobProcessingError,
  trackPrivateQueueEvent,
  trackStorageWarning,
} from "./job-analytics";
import { executeApprovalJob } from "./approval-executor";
import { executeCommitmentQueueJob, executeWorkJob } from "./job-executors";
import { createBrowserJobQueueLifecycle } from "./lifecycle";
import { mediaResourceManager } from "./media-resource-manager";
import type { JobExecution, JobQueueDependencies } from "./ports";
import { MAX_RETRIES } from "./queue-policy";

const browserLifecycle = createBrowserJobQueueLifecycle();

/**
 * What a failed send means, for the reasons work and decisions answer alike: a
 * send that may already be on-chain is confirmed rather than sent again, one
 * never found on-chain waits for the person, and a declined prompt is a choice
 * rather than a failure, so neither spends an attempt.
 */
function waitingAfterFailedSend(error: unknown): JobExecution | undefined {
  if (error instanceof AwaitingWorkConfirmation)
    return { status: "waiting", reason: "awaiting-confirmation" };
  if (error instanceof StrandedSendReopened)
    return { status: "waiting", reason: "send-intent-expired" };
  // A declined work is then held for an explicit send; a decision needs no
  // flag of its own, since Upload all is the only thing that sends it.
  if (isWorkSubmissionCancelled(error)) return { status: "waiting", reason: "send-cancelled" };
  return undefined;
}

function createDefaultExecutorRegistry() {
  const executors: Record<string, JobExecutor> = {
    work: async (jobId, job, chainId, sender) => {
      try {
        return {
          status: "complete",
          txHash: await executeWorkJob(jobId, job as Job<WorkJobPayload>, chainId, sender),
        };
      } catch (error) {
        const waiting = waitingAfterFailedSend(error);
        if (waiting) return waiting;
        if (error instanceof PendingHeicConversionError)
          return { status: "waiting", reason: error.reason };
        if (error instanceof WorkTransactionReverted)
          return { status: "unavailable", reason: "work-transaction-reverted" };
        if (error instanceof InvalidWorkAttachmentError)
          return { status: "unavailable", reason: error.message };
        throw error;
      }
    },
    approval: async (_jobId, job, chainId, sender) => {
      try {
        return {
          status: "complete",
          txHash: await executeApprovalJob(job as Job<ApprovalJobPayload>, chainId, sender),
        };
      } catch (error) {
        const waiting = waitingAfterFailedSend(error);
        if (waiting) return waiting;
        throw error;
      }
    },
  };
  for (const kind of COMMITMENT_JOB_KINDS) {
    executors[kind] = (jobId, job, chainId, sender) =>
      executeCommitmentQueueJob(jobId, job, chainId, sender);
  }
  return createJobExecutorRegistry(executors);
}

export function createDefaultJobQueueDependencies(): JobQueueDependencies {
  return {
    store: jobQueueDB,
    events: jobQueueEventBus,
    executors: createDefaultExecutorRegistry(),
    admission: createCommitmentQueueAdmission({
      isAvailable: (chainId) =>
        selectCommitmentPoolingAvailability(
          getOntologyChainMaturity("entity:commitment-pool", chainId)
        ).status === "available",
      moduleAddress: (chainId) => getNetworkContracts(chainId).commitmentPoolingModule,
      isUndeployed: isZeroAddress,
    }),
    analytics: {
      jobCreated: trackJobCreated,
      jobPermanentlyFailed: trackJobPermanentlyFailed,
      jobProcessed: trackJobProcessed,
      jobProcessingError: trackJobProcessingError,
      storageWarning: trackStorageWarning,
      privateEvent: trackPrivateQueueEvent,
      processingStarted(kind, attempt) {
        addBreadcrumb("job_processing_started", { job_kind: kind, attempt });
      },
    },
    quota: { get: getStorageQuota },
    scheduler: {
      schedule: (task) => scheduleTask(task, { priority: "background" }),
      yield: yieldToMain,
    },
    connectivity: {
      isOnline: () => connectivityStore.getSnapshot(),
      canSend: async () => {
        if (connectivityStore.getStatusSnapshot().state === "offline") return "offline";
        // Probes at most once a minute, so a flush over many jobs neither stops
        // on its own age nor probes once per job.
        if (await connectivityStore.confirmForBackgroundWork()) return null;
        return connectivityStore.getStatusSnapshot().state === "offline"
          ? "offline"
          : "connection-unconfirmed";
      },
    },
    backgroundSync: {
      request() {
        if (typeof navigator !== "undefined") {
          navigator.serviceWorker?.controller?.postMessage({ type: SW_MESSAGE.REGISTER_SYNC });
        }
      },
    },
    clock: { now: () => Date.now() },
    config: {
      defaultChainId: DEFAULT_CHAIN_ID,
      maxRetries: MAX_RETRIES,
      storageQuotaCacheTTL: 30_000,
    },
    lifecycle: {
      attach(cleanup) {
        return browserLifecycle.attach(() => {
          jobQueueEventBus.removeAllListeners();
          mediaResourceManager.cleanupAll();
          cleanup();
        });
      },
    },
    logger,
  };
}
