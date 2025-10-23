import { useEffect, useState } from "react";
import { useQueueFlush } from "../../providers/jobQueue";
import { usePendingWorksCount, useQueueStatistics } from "../work/useWorks";

/** Reports offline status and queue metrics derived from TanStack Query subscriptions. */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const flush = useQueueFlush();

  // Use event-driven hooks instead of polling
  const { data: pendingCount = 0 } = usePendingWorksCount();
  const { data: stats } = useQueueStatistics();

  // Get pending work items using the job queue directly (no polling)
  const pendingWork = stats ? stats.pending + stats.failed : 0;
  void pendingWork; // avoid unused value since we return aggregated values separately

  useEffect(() => {
    let cancelled = false;

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");

      flush()
        .then(() => {
          if (!cancelled) {
            setSyncStatus("idle");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSyncStatus("error");
          }
        });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  return {
    isOnline,
    pendingCount,
    pendingWork: [], // Simplified - components can use useWorksMerged directly if they need the full list
    syncStatus,
    refetch: flush,
  };
}
