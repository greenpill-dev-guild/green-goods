import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo } from "react";
import { useUser } from "@/providers/user";
import { useOfflineStore } from "@/stores/offlineStore";
import { useConflictResolver } from "./useConflictResolver";
import { useOffline } from "./useOffline";
import { useStorageManager } from "./useStorageManager";
import { useDebounced } from "./useDebounced";

/**
 * Bridge hook that syncs data from existing hooks into the Zustand store
 * This maintains compatibility while optimizing performance
 * Only syncs when user is authenticated
 */
export const useOfflineSync = () => {
  const { authenticated } = usePrivy();
  const { smartAccountAddress } = useUser();
  const isAuthenticated = authenticated && smartAccountAddress;

  // Always call hooks (required by React rules), but only use data when authenticated
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const { conflicts } = useConflictResolver();
  const { storageInfo } = useStorageManager();

  const { setOnlineStatus, setSyncStatus, setPendingCount, setConflictCount, setNeedsCleanup } =
    useOfflineStore();

  // Memoize values to prevent unnecessary re-renders
  const conflictCount = useMemo(() => conflicts?.length || 0, [conflicts?.length]);
  const needsCleanup = useMemo(
    () => storageInfo?.needsCleanup || false,
    [storageInfo?.needsCleanup]
  );

  // Debounce frequent state updates to reduce unnecessary re-renders
  const debouncedSetSyncStatus = useDebounced(setSyncStatus, 100);
  const debouncedSetPendingCount = useDebounced(setPendingCount, 200);
  const debouncedSetConflictCount = useDebounced(setConflictCount, 300);
  const debouncedSetNeedsCleanup = useDebounced(setNeedsCleanup, 500);

  // Sync online status (always sync online status regardless of auth)
  useEffect(() => {
    setOnlineStatus(isOnline);
  }, [isOnline, setOnlineStatus]);

  // Only sync other states when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Use debounced setters to reduce frequent updates
      debouncedSetSyncStatus(syncStatus);
      debouncedSetPendingCount(pendingCount);
      debouncedSetConflictCount(conflictCount);
      debouncedSetNeedsCleanup(needsCleanup);
    } else {
      // Reset to default values when not authenticated (immediate, no debounce)
      setSyncStatus("idle");
      setPendingCount(0);
      setConflictCount(0);
      setNeedsCleanup(false);
    }
  }, [
    isAuthenticated,
    syncStatus,
    pendingCount,
    conflictCount,
    needsCleanup,
    debouncedSetSyncStatus,
    debouncedSetPendingCount,
    debouncedSetConflictCount,
    debouncedSetNeedsCleanup,
    setSyncStatus,
    setPendingCount,
    setConflictCount,
    setNeedsCleanup,
  ]);
};
