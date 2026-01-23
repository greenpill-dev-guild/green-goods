/**
 * PostHog Analytics Module
 *
 * Provides a safe wrapper around posthog-js that:
 * - Does NOT initialize PostHog (PostHogProvider handles that)
 * - Safely no-ops when PostHog isn't available
 * - Adds consistent event enrichment
 * - Throttles only diagnostic events, not countable "fact" events
 *
 * Usage:
 * - track() for custom events
 * - identify() to set user identity (call on login)
 * - reset() to clear identity (call on logout)
 * - identifyWithProperties() to set identity + person properties
 */

import { posthog } from "posthog-js";

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

// ============================================================================
// APP VERSION AND ENVIRONMENT
// ============================================================================

/**
 * Get the app version from environment variable or package.json.
 * Falls back to "unknown" if not available.
 */
export function getAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION || "unknown";
}

/**
 * Get the current chain ID from environment.
 * @returns The chain ID if valid, null if missing or invalid
 */
export function getChainId(): number | null {
  const chainId = import.meta.env.VITE_CHAIN_ID;
  if (!chainId) return null;
  const parsed = Number(chainId);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Common testnet chain IDs.
 */
const TESTNET_CHAIN_IDS = new Set([
  84532, // Base Sepolia
  11155111, // Ethereum Sepolia
  421614, // Arbitrum Sepolia
  80002, // Polygon Amoy
  11155420, // Optimism Sepolia
  44787, // Celo Alfajores
]);

/**
 * Known mainnet chain IDs.
 */
const MAINNET_CHAIN_IDS = new Set([
  1, // Ethereum Mainnet
  42161, // Arbitrum One
  42220, // Celo Mainnet
  137, // Polygon
  10, // Optimism
  8453, // Base
]);

/**
 * Determine if the current chain is a testnet.
 */
export function isTestnetEnvironment(chainId?: number | null): boolean {
  const chain = chainId ?? getChainId();
  if (chain === null) return false;
  return TESTNET_CHAIN_IDS.has(chain);
}

/**
 * Determine if the current chain is a known mainnet.
 */
export function isMainnetEnvironment(chainId?: number | null): boolean {
  const chain = chainId ?? getChainId();
  if (chain === null) return false;
  return MAINNET_CHAIN_IDS.has(chain);
}

/**
 * Get the environment name based on chain ID.
 * Returns "unknown" if chain ID is not configured, invalid, or not in known chains.
 */
export function getEnvironment(chainId?: number | null): "testnet" | "mainnet" | "unknown" {
  const chain = chainId ?? getChainId();
  if (chain === null) return "unknown";
  if (isTestnetEnvironment(chain)) return "testnet";
  if (isMainnetEnvironment(chain)) return "mainnet";
  return "unknown";
}

/**
 * Get all app context properties for tracking.
 * These properties are included in all events for consistent context.
 */
export function getAppContext(): {
  app_version: string;
  environment: "testnet" | "mainnet" | "unknown";
  chain_id: number | null;
} {
  const chainId = getChainId();
  return {
    app_version: getAppVersion(),
    environment: getEnvironment(chainId),
    chain_id: chainId,
  };
}

// ============================================================================
// INITIALIZATION CHECK
// ============================================================================

/**
 * Check if PostHog is initialized and ready to capture events.
 * PostHogProvider initializes PostHog - we just check if it's ready.
 */
function isPostHogReady(): boolean {
  try {
    // PostHog is ready if it has a config with an api_host
    const config = (posthog as unknown as { config?: { api_host?: string } }).config;
    return typeof config !== "undefined" && typeof config.api_host === "string";
  } catch {
    return false;
  }
}

// ============================================================================
// THROTTLING (only for diagnostic events)
// ============================================================================

// Events that should be throttled (diagnostics, not countable facts)
const THROTTLED_EVENTS = new Set([
  "app_lifecycle_app_start",
  "app_lifecycle_app_resume",
  "app_lifecycle_app_background",
  "offline_connection_lost",
  "offline_connection_restored",
  "storage_estimate",
]);

const eventThrottle = new Map<string, number>();
const THROTTLE_WINDOW = 5000; // 5 seconds

function shouldThrottleEvent(event: string): boolean {
  // Only throttle diagnostic events
  if (!THROTTLED_EVENTS.has(event)) {
    return false;
  }

  const now = Date.now();
  const lastEventTime = eventThrottle.get(event) || 0;

  if (now - lastEventTime < THROTTLE_WINDOW) {
    return true;
  }

  eventThrottle.set(event, now);
  return false;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// SESSION ID
// ============================================================================

function generateSecureRandomString(length: number): string {
  if (typeof crypto === "undefined") return `fallback_${Date.now()}`;
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .substring(0, length);
}

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "no-session";
  let sessionId = safeGetItem(sessionStorage, "posthog_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${generateSecureRandomString(9)}`;
    safeSetItem(sessionStorage, "posthog_session_id", sessionId);
  }
  return sessionId;
}

// ============================================================================
// CORE TRACKING
// ============================================================================

/**
 * Track a custom event with automatic enrichment.
 *
 * Safe to call even if PostHog isn't initialized - will no-op in dev or if not ready.
 */
export function track(event: string, properties: Record<string, unknown> = {}) {
  // Throttle diagnostic events
  if (shouldThrottleEvent(event)) {
    if (IS_DEBUG) {
      console.log(`[PostHog] THROTTLED: ${event}`);
    }
    return;
  }

  // Enrich with context
  const enrichedProperties = {
    ...properties,
    is_online: typeof navigator !== "undefined" ? navigator.onLine : true,
    connection_type:
      typeof navigator !== "undefined"
        ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection
            ?.effectiveType || "unknown"
        : "unknown",
    timestamp: Date.now(),
    session_id: getSessionId(),
  };

  if (IS_DEBUG) {
    console.log(`[PostHog] track: ${event}`, enrichedProperties);
  }

  // Skip in dev mode or if PostHog isn't ready
  if (IS_DEV) return;
  if (!isPostHogReady()) {
    if (IS_DEBUG) {
      console.warn("[PostHog] Not ready, skipping capture");
    }
    return;
  }

  posthog.capture(event, enrichedProperties);
}

// ============================================================================
// IDENTITY
// ============================================================================

/**
 * Identify a user by their primary address.
 *
 * Call this when a user logs in. The distinctId should be their wallet address
 * (wallet mode) or smart account address (passkey mode).
 */
export function identify(distinctId: string) {
  if (IS_DEBUG) {
    console.log(`[PostHog] identify: ${distinctId}`);
  }
  if (IS_DEV || !isPostHogReady()) return;
  posthog.identify(distinctId);
}

/**
 * Identify a user with person properties.
 *
 * This is the preferred method - sets identity + properties in one call.
 */
export function identifyWithProperties(
  distinctId: string,
  properties: {
    auth_mode?: "wallet" | "passkey" | null;
    app?: "client" | "admin";
    chain_id?: number;
    is_pwa?: boolean;
    locale?: string;
    [key: string]: unknown;
  }
) {
  if (IS_DEBUG) {
    console.log(`[PostHog] identifyWithProperties: ${distinctId}`, properties);
  }
  if (IS_DEV || !isPostHogReady()) return;

  posthog.identify(distinctId, {
    // Standard person properties
    auth_mode: properties.auth_mode,
    app: properties.app,
    chain_id: properties.chain_id,
    is_pwa: properties.is_pwa,
    locale: properties.locale,
    // Spread any additional properties
    ...properties,
  });
}

/**
 * Reset the current user identity.
 *
 * Call this when a user logs out. Creates a new anonymous distinct_id.
 */
export function reset() {
  if (IS_DEBUG) {
    console.log("[PostHog] reset");
  }
  if (IS_DEV || !isPostHogReady()) return;
  posthog.reset();
}

/**
 * Get the current distinct ID.
 */
export function getDistinctId(): string {
  if (IS_DEV) {
    return "dev-user-id";
  }
  if (!isPostHogReady()) {
    return "not-initialized";
  }
  return posthog.get_distinct_id();
}

// ============================================================================
// OFFLINE / SYNC TRACKING
// ============================================================================

const OFFLINE_START_KEY = "gg_offline_start_time";

/**
 * Track offline-specific events with context.
 */
export function trackOfflineEvent(event: string, properties: Record<string, unknown> = {}) {
  track(`offline_${event}`, {
    ...properties,
  });
}

/**
 * Track sync performance with timing metrics.
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
    network_type:
      (navigator as unknown as { connection?: { effectiveType?: string } }).connection
        ?.effectiveType || "unknown",
    connection_downlink:
      (navigator as unknown as { connection?: { downlink?: number } }).connection?.downlink ?? null,
  });
}

/**
 * Track app lifecycle events.
 */
export function trackAppLifecycle(event: "app_start" | "app_resume" | "app_background") {
  track(`app_lifecycle_${event}`, {
    performance_now: typeof performance !== "undefined" ? performance.now() : null,
  });
}

// ============================================================================
// NETWORK STATUS TRACKING
// ============================================================================

let lastOnlineStatus = typeof navigator !== "undefined" ? navigator.onLine : true;
let networkListenersInitialized = false;
let cleanupNetworkListeners: (() => void) | null = null;

function handleOnline() {
  if (!lastOnlineStatus) {
    const offlineStart = safeGetItem(localStorage, OFFLINE_START_KEY);
    const offlineDuration = offlineStart ? Date.now() - parseInt(offlineStart, 10) : null;

    trackOfflineEvent("connection_restored", {
      offline_duration_ms: offlineDuration,
    });

    safeRemoveItem(localStorage, OFFLINE_START_KEY);
  }
  lastOnlineStatus = true;
}

function handleOffline() {
  if (lastOnlineStatus) {
    safeSetItem(localStorage, OFFLINE_START_KEY, Date.now().toString());
    trackOfflineEvent("connection_lost", {});
  }
  lastOnlineStatus = false;
}

function handleVisibilityChange() {
  const event = document.hidden ? "app_background" : "app_resume";
  trackAppLifecycle(event);
}

/**
 * Initialize network status and visibility tracking.
 *
 * @returns A cleanup function to remove all event listeners
 */
export function initNetworkTracking(): () => void {
  if (networkListenersInitialized && cleanupNetworkListeners) {
    return cleanupNetworkListeners;
  }
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  // Track app start (deferred to avoid blocking)
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => trackAppLifecycle("app_start"));
  } else {
    setTimeout(() => trackAppLifecycle("app_start"), 0);
  }

  networkListenersInitialized = true;

  // Return cleanup function
  cleanupNetworkListeners = () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    networkListenersInitialized = false;
    cleanupNetworkListeners = null;
  };

  return cleanupNetworkListeners;
}

// ============================================================================
// GLOBAL PROPERTIES REGISTRATION
// ============================================================================

let globalPropertiesRegistered = false;

/**
 * Register global properties with PostHog.
 * These properties are included in all events automatically.
 *
 * Call this after PostHog is initialized (e.g., in the AppProvider).
 * Safe to call multiple times - will only register once.
 *
 * @returns true if registration was successful or already done, false if PostHog isn't ready
 */
export function registerGlobalProperties(): boolean {
  if (globalPropertiesRegistered) return true;
  if (IS_DEV) {
    globalPropertiesRegistered = true;
    if (IS_DEBUG) {
      console.log("[PostHog] Skipping global properties registration (dev mode)", getAppContext());
    }
    return true;
  }
  if (!isPostHogReady()) {
    if (IS_DEBUG) {
      console.warn("[PostHog] Not ready, skipping global properties registration");
    }
    return false;
  }

  const context = getAppContext();

  // Register super properties - these are included in all events
  posthog.register({
    app_version: context.app_version,
    environment: context.environment,
    chain_id: context.chain_id,
  });

  globalPropertiesRegistered = true;

  if (IS_DEBUG) {
    console.log("[PostHog] Registered global properties:", context);
  }

  return true;
}

// Auto-initialize for backward compatibility (only in browser)
if (typeof window !== "undefined") {
  initNetworkTracking();
}
