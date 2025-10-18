import { useEffect, useState } from "react";
// import { jobQueue } from "@/modules/job-queue";
import { usePendingWorksCount, useQueueStatistics } from "../work/useWorks";

/** Reports offline status and queue metrics derived from TanStack Query subscriptions. */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  // Use event-driven hooks instead of polling
  const { data: pendingCount = 0 } = usePendingWorksCount();
  const { data: stats } = useQueueStatistics();

  // Get pending work items using the job queue directly (no polling)
  const pendingWork = stats ? stats.pending + stats.failed : 0;
  void pendingWork; // avoid unused value since we return aggregated values separately

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");

      // // Sync and update status
      // jobQueue
      //   .flush()
      //   .then(() => {
      //     setSyncStatus("idle");
      //   })
      //   .catch((error) => {
      //     setSyncStatus("error");
      //     console.error("Sync failed:", error);
      //   });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    pendingCount,
    pendingWork: [], // Simplified - components can use useWorksMerged directly if they need the full list
    syncStatus,
    refetch: () => {},
  };
}
