import { jobQueueDB } from "../../modules/job-queue/db";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useLiveQuery } from "../utils/useLiveQuery";

/**
 * Live count of the account's unsynced work jobs. It follows the queue table
 * itself, so a job added or completed in any tab updates it without an event.
 */
export function usePendingWorksCount() {
  const primaryAddress = usePrimaryAddress();
  const live = useLiveQuery(primaryAddress?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: primaryAddress ?? "", kind: "work", synced: false })
  );
  return { ...live, data: live.data?.length };
}
