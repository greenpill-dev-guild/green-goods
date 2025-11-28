import { posthog } from "posthog-js";

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

// Initialize PostHog only if not already initialized
// PostHogProvider will also initialize, but it checks for existing initialization
// Check if PostHog is already initialized by checking for config
const isAlreadyInitialized =
  typeof (posthog as any).config !== "undefined" && (posthog as any).config?.api_host !== undefined;

if (!isAlreadyInitialized && import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
  try {
    posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      debug: IS_DEBUG,
    });
  } catch (error) {
    // PostHog may already be initialized by PostHogProvider
    // This is expected and safe to ignore
    if (IS_DEBUG) {
      console.debug("[PostHog] Initialization skipped - already initialized");
    }
  }
}

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
    if (IS_DEBUG) {
      console.log(`[THROTTLED] ${event}`);
    }
    return;
  }
  // Add offline context to all events
  const enrichedProperties = {
    ...properties,
    is_online: typeof navigator !== "undefined" ? navigator.onLine : true,
    connection_type:
      typeof navigator !== "undefined"
        ? (navigator as any).connection?.effectiveType || "unknown"
        : "unknown",
    timestamp: Date.now(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "node",
    session_id: getSessionId(),
  };

  if (IS_DEBUG) {
    console.log("track", event, enrichedProperties);
  }
  if (!IS_DEV) {
    posthog.capture(event, enrichedProperties);
  }
}

export function identify(distinctId: string) {
  if (IS_DEBUG) {
    console.log("identify", distinctId);
  }
  if (!IS_DEV) {
    posthog.identify(distinctId);
  }
}

export function reset() {
  if (IS_DEBUG) {
    console.log("reset");
  }
  if (!IS_DEV) {
    posthog.reset();
  }
}

export function getDistinctId() {
  if (IS_DEV) {
    if (IS_DEBUG) console.log("getDistinctId");
    return "dev-user-id";
  } else {
    return posthog.get_distinct_id();
  }
}

/**
 * Generate a cryptographically secure random string
 */
function generateSecureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .substring(0, length);
}

/**
 * Safely get item from storage without throwing
 */
function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set item in storage without throwing
 */
function safeSetItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {}
}

/**
 * Get or create a session ID for tracking user sessions
 */
function getSessionId(): string {
  let sessionId = safeGetItem(sessionStorage, "posthog_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${generateSecureRandomString(9)}`;
    safeSetItem(sessionStorage, "posthog_session_id", sessionId);
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
  const offlineStart = safeGetItem(localStorage, "offline_start_time");
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
    const jobQueueData = safeGetItem(localStorage, "job-queue-stats");
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
let lastOnlineStatus = typeof navigator !== "undefined" ? navigator.onLine : true;

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (!lastOnlineStatus) {
      const offlineStart = safeGetItem(localStorage, "offline_start_time");
      const offlineDuration = offlineStart ? Date.now() - parseInt(offlineStart) : null;

      trackOfflineEvent("connection_restored", {
        offline_duration: offlineDuration,
      });

      try {
        localStorage.removeItem("offline_start_time");
      } catch {}
    }
    lastOnlineStatus = true;
  });

  window.addEventListener("offline", () => {
    if (lastOnlineStatus) {
      safeSetItem(localStorage, "offline_start_time", Date.now().toString());
      trackOfflineEvent("connection_lost", {});
    }
    lastOnlineStatus = false;
  });

  // Track page visibility changes for better offline analytics
  document.addEventListener("visibilitychange", () => {
    const event = document.hidden ? "app_background" : "app_resume";
    trackAppLifecycle(event);
  });
}

// Track app start (wrapped in try/catch to be safe at module level)
try {
  trackAppLifecycle("app_start");
} catch (e) {
  if (IS_DEBUG) console.error("[PostHog] Failed to track app start:", e);
}
