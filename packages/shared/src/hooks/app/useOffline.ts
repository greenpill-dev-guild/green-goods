import { useOnlineStatus } from "./useOnlineStatus";
import { useEffect, useState } from "react";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { useQueueFlush } from "../../providers/JobQueue";
import { usePendingWorksCount } from "../work/usePendingWorksCount";

/** Reports offline status and queue metrics derived from TanStack Query subscriptions. */
export function useOffline() {
  const isOnline = useOnlineStatus();
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const flush = useQueueFlush();

  // Use event-driven hook for pending count
  const { data: pendingCount = 0 } = usePendingWorksCount();

  // Reconnection starts queue sync; connectivity itself belongs to useOnlineStatus.
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus("syncing");
      // DON'T call flush() here - JobQueueProvider handles auto-sync for passkey users
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Listen to queue events to update sync status
  useEffect(() => {
    const unsub = jobQueueEventBus.on("queue:sync-completed", () => {
      setSyncStatus("idle");
    });
    return () => unsub();
  }, []);

  return {
    isOnline,
    pendingCount,
    pendingWork: [], // Simplified - components can use useWorksMerged directly if they need the full list
    syncStatus,
    refetch: flush,
  };
}
