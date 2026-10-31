/**
 * Queued work and decision jobs, as the job store holds them. Pass only what a
 * test is about; `payload` is merged into the defaults rather than replacing them.
 */

import type {
  ClaimJobPayload,
  WorkLinkJobPayload,
} from "../../modules/commitment-pooling/job-types";
import type { Address } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";

export const QUEUED_JOB_USER: Address = "0x1111111111111111111111111111111111111111";
export const QUEUED_JOB_GARDEN: Address = "0x2222222222222222222222222222222222222222";

type QueuedJobOverrides<Payload> = Partial<Omit<Job<Payload>, "payload">> & {
  payload?: Partial<Payload>;
};

function queuedJob<Payload>(
  kind: string,
  payload: Payload,
  { payload: patch, ...job }: QueuedJobOverrides<Payload>
): Job<Payload> {
  return {
    id: `${kind}-1`,
    kind,
    chainId: 42161,
    userAddress: QUEUED_JOB_USER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    ...job,
    payload: { ...payload, ...patch },
  } as Job<Payload>;
}

export function queuedWorkJob(overrides: QueuedJobOverrides<WorkJobPayload> = {}) {
  return queuedJob<WorkJobPayload>(
    "work",
    {
      actionUID: 1,
      gardenAddress: QUEUED_JOB_GARDEN,
      feedback: "Weeded",
      clientWorkId: "client-1",
    },
    overrides
  );
}

export function queuedDecisionJob(overrides: QueuedJobOverrides<ApprovalJobPayload> = {}) {
  return queuedJob<ApprovalJobPayload>(
    "approval",
    {
      actionUID: 1,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: QUEUED_JOB_GARDEN,
      gardenerAddress: QUEUED_JOB_USER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    },
    overrides
  );
}

/**
 * One tap's take-up chain (decision 18) as the queue holds it before anything is sent: the
 * claim that takes the ask up, the work for it with its sealed link, and that link's own job.
 */
export function queuedTakeUpChain(commitmentId = 9n) {
  const dependentWorkLink = {
    clientOperationId: `work-link:client-1:${commitmentId}:0`,
    commitmentId,
    clientWorkId: "client-1",
    requirementIndex: 0,
    gardenAddress: QUEUED_JOB_GARDEN,
    operationKey: `0x${"cd".repeat(32)}` as const,
  } satisfies Extract<WorkLinkJobPayload, { clientWorkId: string }>;
  const claim = queuedJob<ClaimJobPayload>(
    "claim",
    {
      commitmentId,
      kind: 1,
      gardenContext: QUEUED_JOB_GARDEN,
      gardenAddress: QUEUED_JOB_GARDEN,
    },
    { id: "take-up" }
  );
  const work = queuedWorkJob({ id: "work-for-it", payload: { dependentWorkLink } });
  const link = queuedJob<WorkLinkJobPayload>(
    "workLink",
    { ...dependentWorkLink, sourceWorkJobId: work.id },
    { id: "its-link" }
  );
  return { claim, work, link };
}
