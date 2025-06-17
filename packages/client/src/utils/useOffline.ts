import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { offlineDB } from "@/modules/offline-db";
import { offlineSync } from "@/modules/offline-sync";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  // Query for pending work count
  const { data: pendingCount = 0, refetch: refetchPendingCount } = useQuery({
    queryKey: ["offlinePendingCount"],
    queryFn: () => offlineSync.getPendingCount(),
    refetchInterval: 5000, // Check every 5 seconds
  });

  // Query for pending work items
  const { data: pendingWork = [], refetch: refetchPendingWork } = useQuery({
    queryKey: ["offlinePendingWork"],
    queryFn: () => offlineDB.getUnsyncedWork(),
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");

      // Sync and update status
      offlineSync
        .sync()
        .then(() => {
          setSyncStatus("idle");
          refetchPendingCount();
          refetchPendingWork();
        })
        .catch(() => {
          setSyncStatus("error");
        });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Start sync service
    offlineSync.startSync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      offlineSync.stopSync();
    };
  }, [refetchPendingCount, refetchPendingWork]);

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
