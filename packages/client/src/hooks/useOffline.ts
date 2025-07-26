import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";

import { jobQueue } from "@/modules/job-queue";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const queryClient = useQueryClient();

  // Query for pending work count - event-driven instead of aggressive polling
  const { data: pendingCount = 0, refetch: refetchPendingCount } = useQuery({
    queryKey: ["offlinePendingCount"],
    queryFn: () => jobQueue.getPendingCount(),
    refetchInterval: 30000, // Reduced to 30 seconds - events will trigger updates
    staleTime: 10000, // 10 seconds stale time
  });

  // Query for pending work items - no automatic polling, rely on events
  const { data: pendingWork = [], refetch: refetchPendingWork } = useQuery({
    queryKey: ["offlinePendingWork"],
    queryFn: () => jobQueue.getJobs({ synced: false }),
    staleTime: 15000, // 15 seconds stale time
  });

  // Memoize event handlers to prevent unnecessary re-subscriptions
  const handleJobQueueEvent = useCallback(() => {
    // Invalidate queries when job queue events occur
    queryClient.invalidateQueries({ queryKey: ["offlinePendingCount"] });
    queryClient.invalidateQueries({ queryKey: ["offlinePendingWork"] });
  }, [queryClient]);

  useEffect(() => {
    // Abort controller for cleanup of async operations
    const abortController = new AbortController();

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");

      // Sync and update status with abort signal
      jobQueue
        .flush()
        .then(() => {
          if (!abortController.signal.aborted) {
            setSyncStatus("idle");
            // Event-driven updates instead of manual refetch
            handleJobQueueEvent();
          }
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            setSyncStatus("error");
            console.error("Sync failed:", error);
          }
        });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Subscribe to job queue events for reactive updates
    const unsubscribe = jobQueue.subscribe((event) => {
      if (["job_added", "job_completed", "job_failed"].includes(event.type)) {
        handleJobQueueEvent();
      }
    });

    // Note: Periodic sync is now started only in JobQueueProvider to avoid duplicates

    return () => {
      abortController.abort(); // Cancel any pending async operations
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [handleJobQueueEvent]);

  return {
    isOnline,
    pendingCount,
    pendingWork,
    syncStatus,
    refetch: () => {
      refetchPendingCount();
      refetchPendingWork();
    },
  };
}
