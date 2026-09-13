import { useEffect, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";

/** Transient sending state is never restored as an active operation after restart. */
export function useSendingWorkIds(account: string | null | undefined, chainId: number) {
  const [sending, setSending] = useState<Set<string>>(() => new Set());
  useEffect(() => setSending(new Set()), [account, chainId]);
  useJobQueueEvents(
    ["job:processing", "job:completed", "job:failed", "queue:sync-completed"],
    (event, data) => {
      if (event === "queue:sync-completed") {
        setSending(new Set());
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
        const next = new Set(previous);
        if (event === "job:processing") next.add(data.job.id);
        else next.delete(data.job.id);
        return next;
      });
    }
  );
  return sending;
}
