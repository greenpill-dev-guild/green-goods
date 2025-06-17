import { useCallback, useEffect, useRef, useState } from "react";

interface SmartLoadingOptions {
  minLoadingTime?: number; // Minimum time to show loading (prevents flashing)
  debounceTime?: number; // Debounce before showing loading
  showSkeletonAfter?: number; // Show skeleton after this time
}

interface LoadingState {
  isLoading: boolean;
  isDebouncing: boolean;
  showSkeleton: boolean;
  startTime: number | null;
}

export function useSmartLoading(options: SmartLoadingOptions = {}) {
  const { minLoadingTime = 500, debounceTime = 100, showSkeletonAfter = 200 } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    isDebouncing: false,
    showSkeleton: false,
    startTime: null,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const skeletonTimeoutRef = useRef<NodeJS.Timeout>();
  const minTimeTimeoutRef = useRef<NodeJS.Timeout>();

  const startLoading = useCallback(() => {
    // Clear any existing timeouts
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
    }
    if (minTimeTimeoutRef.current) {
      clearTimeout(minTimeTimeoutRef.current);
    }

    setState((prev) => ({ ...prev, isDebouncing: true }));

    // Start debounce timer
    debounceTimeoutRef.current = setTimeout(() => {
      const startTime = performance.now();
      setState((prev) => ({
        ...prev,
        isLoading: true,
        isDebouncing: false,
        startTime,
      }));

      // Show skeleton after specified time
      skeletonTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, showSkeleton: true }));
      }, showSkeletonAfter);
    }, debounceTime);
  }, [debounceTime, showSkeletonAfter]);

  const stopLoading = useCallback(() => {
    setState((prev) => {
      const { startTime } = prev;

      // Clear timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }

      // If we're still debouncing, just stop everything
      if (prev.isDebouncing) {
        return {
          isLoading: false,
          isDebouncing: false,
          showSkeleton: false,
          startTime: null,
        };
      }

      // If loading started, ensure minimum loading time
      if (startTime !== null) {
        const elapsed = performance.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsed);

        if (remainingTime > 0) {
          minTimeTimeoutRef.current = setTimeout(() => {
            setState({
              isLoading: false,
              isDebouncing: false,
              showSkeleton: false,
              startTime: null,
            });
          }, remainingTime);

          // Don't update state yet, let the timeout handle it
          return prev;
        }
      }

      return {
        isLoading: false,
        isDebouncing: false,
        showSkeleton: false,
        startTime: null,
      };
    });
  }, [minLoadingTime]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }
      if (minTimeTimeoutRef.current) {
        clearTimeout(minTimeTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading: state.isLoading,
    isDebouncing: state.isDebouncing,
    showSkeleton: state.showSkeleton,
    startLoading,
    stopLoading,
    // Convenience computed values
    isActive: state.isLoading || state.isDebouncing,
    shouldShowContent: !state.isLoading && !state.isDebouncing,
  };
}

// Hook for managing async operations with smart loading
export function useAsyncOperation<T = any>() {
  const loading = useSmartLoading();
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (operation: () => Promise<T>) => {
      loading.startLoading();
      setError(null);

      try {
        const result = await operation();
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("An error occurred");
        setError(error);
        throw error;
      } finally {
        loading.stopLoading();
      }
    },
    [loading]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
    loading.stopLoading();
  }, [loading]);

  return {
    ...loading,
    data,
    error,
    execute,
    reset,
    hasData: data !== null,
    hasError: error !== null,
  };
}
