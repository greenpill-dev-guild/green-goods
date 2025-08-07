import { posthog } from "posthog-js";

const IS_DEV = import.meta.env.DEV;

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  debug: IS_DEV,
});

// Event throttling to prevent excessive events
const eventThrottle = new Map<string, number>();
const THROTTLE_WINDOW = 5000; // 5 seconds

function shouldThrottleEvent(event: string): boolean {
  const now = Date.now();
  const lastEventTime = eventThrottle.get(event) || 0;

  if (now - lastEventTime < THROTTLE_WINDOW) {
    return true; // Throttle this event
  }

  eventThrottle.set(event, now);
  return false; // Allow this event
}

export function track(event: string, properties: Record<string, unknown>) {
  // Throttle frequent events
  if (shouldThrottleEvent(event)) {
    if (IS_DEV) {
      console.log(`[THROTTLED] ${event}`);
    }
    return;
  }
  // Add offline context to all events
  const enrichedProperties = {
    ...properties,
    is_online: navigator.onLine,
    connection_type: (navigator as any).connection?.effectiveType || "unknown",
    timestamp: Date.now(),
    user_agent: navigator.userAgent,
    session_id: getSessionId(),
  };

  if (IS_DEV) {
    console.log("track", event, enrichedProperties);
  } else {
    posthog.capture(event, enrichedProperties);
  }
}

export function identify(distinctId: string) {
  if (IS_DEV) {
    console.log("identify", distinctId);
  } else {
    posthog.identify(distinctId);
  }
}

export function reset() {
  if (IS_DEV) {
    console.log("reset");
  } else {
    posthog.reset();
  }
}

export function getDistinctId() {
  if (IS_DEV) {
    console.log("getDistinctId");
    return "dev-user-id";
  } else {
    return posthog.get_distinct_id();
  }
}

/**
 * Get or create a session ID for tracking user sessions
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem("posthog_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("posthog_session_id", sessionId);
  }
  return sessionId;
}

/**
 * Track offline-specific events with detailed context
 */
export function trackOfflineEvent(event: string, properties: Record<string, unknown> = {}) {
  track(`offline_${event}`, {
    ...properties,
    offline_duration: getOfflineDuration(),
    queue_size: getQueueSize(),
    storage_usage: getStorageUsage(),
  });
}

/**
 * Track sync performance with detailed metrics
 */
export function trackSyncPerformance(
  operation: string,
  startTime: number,
  success: boolean,
  details: Record<string, unknown> = {}
) {
  const duration = Date.now() - startTime;

  track(`sync_${operation}`, {
    ...details,
    success,
    duration_ms: duration,
    network_type: (navigator as any).connection?.effectiveType || "unknown",
    connection_downlink: (navigator as any).connection?.downlink || null,
    sync_timestamp: Date.now(),
  });
}

/**
 * Track app lifecycle events for offline analysis
 */
export function trackAppLifecycle(event: "app_start" | "app_resume" | "app_background") {
  track(`app_lifecycle_${event}`, {
    performance_now: performance.now(),
    memory_usage: getMemoryUsage(),
    storage_quota: getStorageQuota(),
  });
}

/**
 * Get offline duration if available
 */
function getOfflineDuration(): number | null {
  const offlineStart = localStorage.getItem("offline_start_time");
  if (offlineStart && !navigator.onLine) {
    return Date.now() - parseInt(offlineStart);
  }
  return null;
}

/**
 * Get approximate queue size from localStorage
 */
function getQueueSize(): number {
  try {
    const jobQueueData = localStorage.getItem("job-queue-stats");
    return jobQueueData ? JSON.parse(jobQueueData).pending || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Get storage usage information
 */
function getStorageUsage(): Record<string, unknown> {
  try {
    const usage = {
      localStorage: JSON.stringify(localStorage).length,
      sessionStorage: JSON.stringify(sessionStorage).length,
    };

    // Estimate IndexedDB usage (simplified)
    if ("storage" in navigator && "estimate" in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        track("storage_estimate", {
          quota: estimate.quota,
          usage: estimate.usage,
          usage_percentage: estimate.quota ? (estimate.usage! / estimate.quota) * 100 : null,
        });
      });
    }

    return usage;
  } catch {
    return {};
  }
}

/**
 * Get memory usage if available
 */
function getMemoryUsage(): Record<string, unknown> {
  try {
    if ("memory" in performance && performance.memory) {
      return {
        used_heap: (performance.memory as any).usedJSHeapSize,
        total_heap: (performance.memory as any).totalJSHeapSize,
        heap_limit: (performance.memory as any).jsHeapSizeLimit,
      };
    }
  } catch {}
  return {};
}

/**
 * Get storage quota information
 */
function getStorageQuota(): Promise<Record<string, unknown> | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    return navigator.storage.estimate().then((estimate) => ({
      quota: estimate.quota,
      usage: estimate.usage,
    }));
  }
  return Promise.resolve(null);
}

// Track network status changes
let lastOnlineStatus = navigator.onLine;
window.addEventListener("online", () => {
  if (!lastOnlineStatus) {
    const offlineStart = localStorage.getItem("offline_start_time");
    const offlineDuration = offlineStart ? Date.now() - parseInt(offlineStart) : null;

    trackOfflineEvent("connection_restored", {
      offline_duration: offlineDuration,
    });

    localStorage.removeItem("offline_start_time");
  }
  lastOnlineStatus = true;
});

window.addEventListener("offline", () => {
  if (lastOnlineStatus) {
    localStorage.setItem("offline_start_time", Date.now().toString());
    trackOfflineEvent("connection_lost", {});
  }
  lastOnlineStatus = false;
});

// Track page visibility changes for better offline analytics
document.addEventListener("visibilitychange", () => {
  const event = document.hidden ? "app_background" : "app_resume";
  trackAppLifecycle(event);
});

// Track app start
trackAppLifecycle("app_start");
