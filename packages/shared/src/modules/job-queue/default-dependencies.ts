import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getOntologyChainMaturity } from "../../ontology/query";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { scheduleTask, yieldToMain } from "../../utils/scheduler";
import { getStorageQuota } from "../../utils/storage/quota";
import { addBreadcrumb } from "../app/error-tracking";
import { logger } from "../app/logger";
import { createCommitmentQueueAdmission } from "../commitment-pooling/queue-admission";
import { COMMITMENT_JOB_KINDS } from "../commitment-pooling/jobs";
import { selectCommitmentPoolingAvailability } from "../commitment-pooling/selectors";
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
import { executeApprovalJob, executeCommitmentQueueJob, executeWorkJob } from "./job-executors";
import { createBrowserJobQueueLifecycle } from "./lifecycle";
import { mediaResourceManager } from "./media-resource-manager";
import type { JobQueueDependencies } from "./ports";
import { MAX_RETRIES } from "./queue-policy";

const browserLifecycle = createBrowserJobQueueLifecycle();

function createDefaultExecutorRegistry() {
  const executors: Record<string, JobExecutor> = {
    work: async (jobId, job, chainId, sender) => ({
      status: "complete",
      txHash: await executeWorkJob(jobId, job as Job<WorkJobPayload>, chainId, sender),
    }),
    approval: async (_jobId, job, chainId, sender) => ({
      status: "complete",
      txHash: await executeApprovalJob(job as Job<ApprovalJobPayload>, chainId, sender),
    }),
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
      isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    },
    backgroundSync: {
      request() {
        if (typeof navigator !== "undefined") {
          navigator.serviceWorker?.controller?.postMessage({ type: "REGISTER_SYNC" });
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
