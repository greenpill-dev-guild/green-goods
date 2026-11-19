import { useEffect, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { jobQueueEventBus, useJobQueueEvents } from "../../modules/job-queue/event-bus";
import type { JobSendPhase } from "../../modules/job-queue/ports";
import { sendCheckpointOf } from "../../modules/job-queue/queue-policy";
import type { Job } from "../../types/job-queue";

/** A work job being sent now, and the stage its send reported, if it reported one yet. */
export type SendingWork = ReadonlyMap<string, JobSendPhase["stage"] | null>;

/** Whether a job is this account's work on this chain. */
function isOwnWork(job: Job, account: string | null | undefined, chainId: number): boolean {
  return (
    job.kind === "work" &&
    job.userAddress.toLowerCase() === account?.toLowerCase() &&
    (job.chainId ?? DEFAULT_CHAIN_ID) === chainId
  );
}

/**
 * Where a try of this work starts: a work whose broadcast is on record went out, so a recheck of
 * it is confirming, never uploading. Any other try reports its stage as it goes.
 */
function startingStage(job: Job): JobSendPhase["stage"] | null {
  const sent = sendCheckpointOf(job);
  return sent?.broadcast || sent?.transactionHash ? "confirming" : null;
}

/** The account's sends under way now, as the bus holds them. */
function sendsUnderWay(account: string | null | undefined, chainId: number): SendingWork {
  const stages = new Map<string, JobSendPhase["stage"] | null>();
  for (const [jobId, { job, stage }] of jobQueueEventBus.currentSendStages())
    if (isOwnWork(job, account, chainId)) stages.set(jobId, stage);
  return stages;
}

/**
 * The account's work being sent now, by job id, with the stage each send reported: Upload now,
 * Upload all and the background flush alike, since the queue reports every send's stage on its
 * events (PRD-1552). A screen that mounts in the middle of a send starts from the stage the bus
 * holds. Transient: a restart never restores a send as under way.
 */
export function useSendingWork(account: string | null | undefined, chainId: number): SendingWork {
  const [sending, setSending] = useState<SendingWork>(() => sendsUnderWay(account, chainId));
  useEffect(() => setSending(sendsUnderWay(account, chainId)), [account, chainId]);
  useJobQueueEvents(
    [
      "job:processing",
      "job:stage",
      "job:added",
      "job:completed",
      "job:failed",
      "queue:sync-completed",
    ],
    (event, data) => {
      if (event === "queue:sync-completed") {
        // A flush ended, which says nothing about a send another holder is reporting (Upload
        // all's call, say): only a mark with no stage behind it is dropped.
        setSending((previous) => new Map([...previous].filter(([, stage]) => stage !== null)));
        return;
      }
      if (!("job" in data) || !isOwnWork(data.job, account, chainId)) return;
      setSending((previous) => {
        const next = new Map(previous);
        // A try of a work Upload all just sent keeps saying confirming while the queue finishes it.
        if (event === "job:processing") {
          if (!next.has(data.job.id)) next.set(data.job.id, startingStage(data.job));
        } else if (event === "job:stage" && "stage" in data && data.stage)
          next.set(data.job.id, data.stage);
        else next.delete(data.job.id);
        return next;
      });
    }
  );
  return sending;
}
