import { useJobQueue } from "../../providers/JobQueue";
import { useOnlineStatus } from "./useOnlineStatus";
import { usePendingWorksCount } from "../work/usePendingWorksCount";

/** Reports offline status and queue metrics derived from TanStack Query subscriptions. */
export function useOffline() {
  const isOnline = useOnlineStatus();
  const { flush, isProcessing } = useJobQueue();

  // Use event-driven hook for pending count
  const { data: pendingCount = 0 } = usePendingWorksCount();

  return {
    isOnline,
    pendingCount,
    syncStatus: isProcessing ? ("syncing" as const) : ("idle" as const),
    refetch: flush,
  };
}
