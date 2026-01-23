import { useEffect, useState } from "react";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { useQueueFlush } from "../../providers/JobQueue";
import { usePendingWorksCount } from "../work/useWorks";

/** Reports offline status and queue metrics derived from TanStack Query subscriptions. */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const flush = useQueueFlush();

  // Use event-driven hook for pending count
  const { data: pendingCount = 0 } = usePendingWorksCount();

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");
      // DON'T call flush() here - JobQueueProvider handles auto-sync for passkey users
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
