import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { queueKeys } from "../../config/query-keys/misc";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

/** Event-driven count of unsynced work jobs for the current account. */
export function usePendingWorksCount() {
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();

  const query = useQuery({
    queryKey: queueKeys.pendingCount(),
    queryFn: async () => {
      if (!primaryAddress) return 0;
      const jobs = await jobQueue.getJobs(primaryAddress, { kind: "work", synced: false });
      return jobs.length;
    },
    enabled: Boolean(primaryAddress),
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });

  useJobQueueEvents(["job:added", "job:completed", "job:failed"], () => {
    queryClient.invalidateQueries({ queryKey: queueKeys.pendingCount() });
  });

  return query;
}
