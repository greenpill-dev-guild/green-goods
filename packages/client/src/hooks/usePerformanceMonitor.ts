import { useCallback, useEffect, useRef } from "react";

interface PerformanceMetrics {
  navigationTiming: PerformanceNavigationTiming | null;
  paintTiming: PerformancePaintTiming[];
  resourceTiming: PerformanceResourceTiming[];
  memoryInfo: any;
  connectionInfo: any;
}

interface UsePerformanceMonitorOptions {
  trackMemory?: boolean;
  trackResources?: boolean;
  trackPaint?: boolean;
  trackNavigation?: boolean;
  reportInterval?: number;
  onReport?: (metrics: Partial<PerformanceMetrics>) => void;
}

export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}) {
  const {
    trackMemory = true,
    trackResources = true,
    trackPaint = true,
    trackNavigation = true,
    reportInterval = 10000, // 10 seconds
    onReport,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout>();
  const lastReportTime = useRef<number>(performance.now());

  const getNavigationTiming = useCallback((): PerformanceNavigationTiming | null => {
    if (!trackNavigation) return null;

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return navigation || null;
  }, [trackNavigation]);

  const getPaintTiming = useCallback((): PerformancePaintTiming[] => {
    if (!trackPaint) return [];

    return performance.getEntriesByType("paint") as PerformancePaintTiming[];
  }, [trackPaint]);

  const getResourceTiming = useCallback((): PerformanceResourceTiming[] => {
    if (!trackResources) return [];

    const currentTime = performance.now();
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

    // Get only resources loaded since last report
    const newResources = resources.filter(
      (resource) => resource.startTime > lastReportTime.current
    );

    return newResources;
  }, [trackResources]);

  const getMemoryInfo = useCallback(() => {
    if (!trackMemory) return null;

    // @ts-ignore - memory is not in standard types but exists in Chrome
    const memory = (performance as any).memory;
    if (!memory) return null;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }, [trackMemory]);

  const getConnectionInfo = useCallback(() => {
    // @ts-ignore - connection is experimental
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (!connection) return null;

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }, []);

  const collectMetrics = useCallback((): Partial<PerformanceMetrics> => {
    const metrics: Partial<PerformanceMetrics> = {};

    if (trackNavigation) {
      metrics.navigationTiming = getNavigationTiming();
    }

    if (trackPaint) {
      metrics.paintTiming = getPaintTiming();
    }

    if (trackResources) {
      metrics.resourceTiming = getResourceTiming();
    }

    if (trackMemory) {
      metrics.memoryInfo = getMemoryInfo();
    }

    metrics.connectionInfo = getConnectionInfo();

    return metrics;
  }, [
    trackNavigation,
    trackPaint,
    trackResources,
    trackMemory,
    getNavigationTiming,
    getPaintTiming,
    getResourceTiming,
    getMemoryInfo,
    getConnectionInfo,
  ]);

  const reportMetrics = useCallback(() => {
    const metrics = collectMetrics();
    onReport?.(metrics);
    lastReportTime.current = performance.now();

    // Clear old performance entries to prevent memory leaks
    if (trackResources && performance.clearResourceTimings) {
      performance.clearResourceTimings();
    }
  }, [collectMetrics, onReport, trackResources]);

  // Start monitoring
  useEffect(() => {
    if (onReport) {
      // Initial report
      reportMetrics();

      // Set up interval reporting
      intervalRef.current = setInterval(reportMetrics, reportInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [reportMetrics, reportInterval, onReport]);

  return {
    collectMetrics,
    reportMetrics,
  };
}

// Hook for measuring component render performance
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(performance.now());
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now() - renderStartTime.current;
    totalRenderTime.current += renderTime;

    if (import.meta.env.DEV) {
      console.log(`[${componentName}] Render #${renderCount.current}: ${renderTime.toFixed(2)}ms`);
      console.log(
        `[${componentName}] Average render time: ${(totalRenderTime.current / renderCount.current).toFixed(2)}ms`
      );
    }

    // Reset for next render
    renderStartTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
    averageRenderTime: renderCount.current > 0 ? totalRenderTime.current / renderCount.current : 0,
  };
}

// Hook for measuring function execution time
export function usePerformanceMeasure() {
  const measure = useCallback((name: string, fn: () => any) => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    }

    return result;
  }, []);

  const measureAsync = useCallback(async (name: string, fn: () => Promise<any>) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    }

    return result;
  }, []);

  return { measure, measureAsync };
}

// Hook for detecting performance issues
export function usePerformanceIssueDetection() {
  const slowRenderThreshold = 16; // 16ms for 60fps
  const memoryLeakThreshold = 50 * 1024 * 1024; // 50MB
  const longTaskThreshold = 50; // 50ms

  const checkForIssues = useCallback(
    (metrics: Partial<PerformanceMetrics>) => {
      const issues: string[] = [];

      // Check memory usage
      if (metrics.memoryInfo) {
        const { usedJSHeapSize } = metrics.memoryInfo;
        if (usedJSHeapSize > memoryLeakThreshold) {
          issues.push(`High memory usage: ${(usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        }
      }

      // Check for slow resources
      if (metrics.resourceTiming) {
        metrics.resourceTiming.forEach((resource) => {
          const loadTime = resource.responseEnd - resource.startTime;
          if (loadTime > 1000) {
            // 1 second
            issues.push(`Slow resource: ${resource.name} took ${loadTime.toFixed(2)}ms`);
          }
        });
      }

      // Check navigation timing
      if (metrics.navigationTiming) {
        const { domContentLoadedEventEnd, fetchStart } = metrics.navigationTiming;
        const domLoadTime = domContentLoadedEventEnd - fetchStart;
        if (domLoadTime > 3000) {
          // 3 seconds
          issues.push(`Slow DOM load: ${domLoadTime.toFixed(2)}ms`);
        }
      }

      return issues;
    },
    [memoryLeakThreshold]
  );

  return { checkForIssues };
}

// Hook for basic vital metrics using native APIs
export function useBasicVitals(onVital?: (vital: { name: string; value: number }) => void) {
  useEffect(() => {
    if (!onVital) return;

    // Monitor paint timing
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "paint") {
          onVital({
            name: entry.name as string,
            value: entry.startTime,
          });
        }

        if (entry.entryType === "largest-contentful-paint") {
          onVital({
            name: "LCP",
            value: entry.startTime,
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ["paint", "largest-contentful-paint"] });
    } catch (error) {
      console.warn("Performance observer not supported:", error);
    }

    return () => {
      observer.disconnect();
    };
  }, [onVital]);
}
