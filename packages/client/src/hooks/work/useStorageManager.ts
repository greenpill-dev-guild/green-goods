import { useCallback, useEffect, useState } from "react";
import {
  type CleanupResult,
  defaultStorageManager,
  type StorageAnalytics,
} from "../../modules/work/storage-manager";

export interface UseStorageManagerReturn {
  storageInfo: StorageAnalytics | null;
  isLoading: boolean;
  isCleaningUp: boolean;
  error: string | null;
  performCleanup: () => Promise<CleanupResult | null>;
  refreshStorageInfo: () => Promise<void>;
  shouldPerformCleanup: () => Promise<boolean>;
}

export const useStorageManager = (): UseStorageManagerReturn => {
  const [storageInfo, setStorageInfo] = useState<StorageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStorageInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const analytics = await defaultStorageManager.getAnalytics();
      setStorageInfo(analytics);
    } catch (err) {
      // Error handled by setting error state
      setError(err instanceof Error ? err.message : "Failed to fetch storage info");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const performCleanup = useCallback(async (): Promise<CleanupResult | null> => {
    try {
      setIsCleaningUp(true);
      setError(null);

      const result = await defaultStorageManager.performCleanup();

      // Refresh storage info after cleanup
      await refreshStorageInfo();

      return result;
    } catch (err) {
      // Error handled by setting error state
      setError(err instanceof Error ? err.message : "Failed to perform cleanup");
      return null;
    } finally {
      setIsCleaningUp(false);
    }
  }, [refreshStorageInfo]);

  const shouldPerformCleanup = useCallback(async (): Promise<boolean> => {
    try {
      return await defaultStorageManager.shouldPerformCleanup();
    } catch {
      // Error handled by returning false
      return false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  // Periodic refresh (every 5 minutes - storage changes slowly)
  useEffect(() => {
    const interval = setInterval(refreshStorageInfo, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [refreshStorageInfo]);

  return {
    storageInfo,
    isLoading,
    isCleaningUp,
    error,
    performCleanup,
    refreshStorageInfo,
    shouldPerformCleanup,
  };
};
