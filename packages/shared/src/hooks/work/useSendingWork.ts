import { useEffect, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import type { JobSendPhase } from "../../modules/job-queue/ports";

/** A work job being sent now, and the stage its send reported, if it reported one yet. */
export type SendingWork = ReadonlyMap<string, JobSendPhase["stage"] | null>;

/**
 * The account's work being sent now, by job id, with the stage each send reported: Upload now,
 * Upload all and the background flush alike, since the queue reports every send's stage on its
 * events (PRD-1552). Transient: a restart never restores a send as under way.
 */
export function useSendingWork(account: string | null | undefined, chainId: number): SendingWork {
  const [sending, setSending] = useState<SendingWork>(() => new Map());
  useEffect(() => setSending(new Map()), [account, chainId]);
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
        setSending(new Map());
        return;
      }
      if (
        !("job" in data) ||
        data.job.kind !== "work" ||
        data.job.userAddress.toLowerCase() !== account?.toLowerCase() ||
        (data.job.chainId ?? DEFAULT_CHAIN_ID) !== chainId
      )
        return;
      setSending((previous) => {
        const next = new Map(previous);
        if (event === "job:processing") next.set(data.job.id, null);
        else if (event === "job:stage" && "stage" in data && data.stage)
          next.set(data.job.id, data.stage);
        else next.delete(data.job.id);
        return next;
      });
    }
  );
  return sending;
}
