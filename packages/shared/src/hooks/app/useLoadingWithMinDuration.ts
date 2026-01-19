import { useEffect, useRef, useState } from "react";

export interface UseLoadingWithMinDurationOptions {
  /** Minimum time to show loading state (prevents flash of content). Default: 1500ms */
  minMs?: number;
  /** Maximum time to wait before timing out. Default: 15000ms */
  maxMs?: number;
}

export interface UseLoadingWithMinDurationResult {
  /** Whether to show the skeleton/loading UI */
  showSkeleton: boolean;
  /** Whether the loading has timed out */
  timedOut: boolean;
  /** Reset the timer state (call on retry) */
  reset: () => void;
}

/**
 * Manages loading state with minimum display duration and timeout.
 *
 * Prevents flash of cached content by enforcing a minimum skeleton display time,
 * and prevents infinite skeleton by timing out after a maximum duration.
 *
 * @param isLoading - Whether data is currently being fetched
 * @param hasData - Whether cached/placeholder data is available
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data, isFetching, isPending } = useQuery(...);
 * const isLoadingData = isPending || (isFetching && !data?.length);
 *
 * const { showSkeleton, timedOut, reset } = useLoadingWithMinDuration(
 *   isLoadingData,
 *   data?.length > 0
 * );
 *
 * if (timedOut) return <ErrorState onRetry={reset} />;
 * if (showSkeleton) return <Skeleton />;
 * return <Content data={data} />;
 * ```
 */
export function useLoadingWithMinDuration(
  isLoading: boolean,
  hasData: boolean,
  options: UseLoadingWithMinDurationOptions = {}
): UseLoadingWithMinDurationResult {
  const { minMs = 1500, maxMs = 15_000 } = options;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const minTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Minimum display time effect
  useEffect(() => {
    if (isLoading && !minTimeElapsed) {
      minTimerRef.current = setTimeout(() => setMinTimeElapsed(true), minMs);
    }
    return () => clearTimeout(minTimerRef.current);
  }, [isLoading, minTimeElapsed, minMs]);

  // Maximum loading timeout effect
  useEffect(() => {
    if (isLoading && !timedOut && !hasData) {
      maxTimerRef.current = setTimeout(() => setTimedOut(true), maxMs);
    }
    // Clear timeout if loading completes or data arrives
    if (!isLoading || hasData) {
      clearTimeout(maxTimerRef.current);
      if (!isLoading) setTimedOut(false);
    }
    return () => clearTimeout(maxTimerRef.current);
  }, [isLoading, timedOut, hasData, maxMs]);

  const reset = () => {
    setMinTimeElapsed(false);
    setTimedOut(false);
    clearTimeout(minTimerRef.current);
    clearTimeout(maxTimerRef.current);
  };

  // Show skeletons until min time elapsed OR if no cached data available
  const showSkeleton = isLoading && (!hasData || !minTimeElapsed) && !timedOut;

  return { showSkeleton, timedOut, reset };
}
