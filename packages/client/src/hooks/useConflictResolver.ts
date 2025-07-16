import { useCallback, useEffect, useState } from "react";
import { defaultConflictResolver, type WorkConflict } from "../modules/conflict-resolver";

export interface UseConflictResolverReturn {
  conflicts: WorkConflict[];
  isLoading: boolean;
  isResolving: boolean;
  error: string | null;
  detectConflicts: (workItems: any[]) => Promise<WorkConflict[]>;
  resolveConflict: (workId: string, resolution: string, data?: any) => Promise<any>;
  clearConflict: (workId: string) => void;
  clearAllConflicts: () => void;
  refreshConflicts: () => void;
  getConflictById: (workId: string) => WorkConflict | undefined;
}

export const useConflictResolver = (): UseConflictResolverReturn => {
  const [conflicts, setConflicts] = useState<WorkConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConflicts = useCallback(() => {
    const currentConflicts = defaultConflictResolver.getConflicts();
    setConflicts(currentConflicts);
  }, []);

  const detectConflicts = useCallback(async (workItems: any[]): Promise<WorkConflict[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const detectedConflicts = await defaultConflictResolver.detectConflicts(workItems);
      setConflicts(detectedConflicts);

      return detectedConflicts;
    } catch (err) {
      // Error handled by setting error state
      setError(err instanceof Error ? err.message : "Failed to detect conflicts");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveConflict = useCallback(
    async (workId: string, resolution: string, data?: any): Promise<any> => {
      try {
        setIsResolving(true);
        setError(null);

        const result = await defaultConflictResolver.resolveConflict(
          workId,
          resolution as "merge" | "keep_local" | "keep_remote" | "manual",
          data
        );

        // Refresh conflicts after resolution
        refreshConflicts();

        return result;
      } catch (err) {
        // Error handled by setting error state
        setError(err instanceof Error ? err.message : "Failed to resolve conflict");
        throw err; // Re-throw so calling code can handle it
      } finally {
        setIsResolving(false);
      }
    },
    [refreshConflicts]
  );

  const clearConflict = useCallback(
    (workId: string) => {
      defaultConflictResolver.clearConflict(workId);
      refreshConflicts();
    },
    [refreshConflicts]
  );

  const clearAllConflicts = useCallback(() => {
    defaultConflictResolver.clearAllConflicts();
    refreshConflicts();
  }, [refreshConflicts]);

  const getConflictById = useCallback((workId: string): WorkConflict | undefined => {
    return defaultConflictResolver.getConflictById(workId);
  }, []);

  // Initial load
  useEffect(() => {
    refreshConflicts();
  }, [refreshConflicts]);

  return {
    conflicts,
    isLoading,
    isResolving,
    error,
    detectConflicts,
    resolveConflict,
    clearConflict,
    clearAllConflicts,
    refreshConflicts,
    getConflictById,
  };
};
