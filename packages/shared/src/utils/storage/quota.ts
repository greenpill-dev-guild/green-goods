/**
 * Storage Quota Monitoring Utility
 *
 * Provides functions to monitor browser storage quota usage for IndexedDB
 * and other storage APIs. Useful for detecting low storage conditions before
 * they cause silent failures in the offline job queue.
 *
 * Uses the Storage API (navigator.storage.estimate()) which is supported
 * in all modern browsers.
 *
 * @module utils/storage/quota
 */

import { trackStorageError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { track } from "../../modules/app/posthog";
import {
  createQueryPersister,
  PERSIST_MAX_AGE,
  type PersistedClient,
} from "../../config/query-persistence";

// ============================================================================
// TYPES
// ============================================================================

export interface StorageQuotaInfo {
  /** Used storage in bytes */
  used: number;
  /** Total quota in bytes */
  quota: number;
  /** Percentage of quota used (0-100) */
  percentUsed: number;
  /** True if storage is running low (> 80% used) */
  isLow: boolean;
  /** True if storage is critically low (> 90% used) */
  isCritical: boolean;
}

export interface StorageQuotaThresholds {
  /** Percentage threshold for "low" storage warning (default: 80) */
  lowThreshold: number;
  /** Percentage threshold for "critical" storage warning (default: 90) */
  criticalThreshold: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default threshold for "low storage" warning */
export const DEFAULT_LOW_THRESHOLD = 80;

/** Default threshold for "critical storage" warning */
export const DEFAULT_CRITICAL_THRESHOLD = 90;

/** Minimum quota to consider storage API working (10MB) */
const MIN_VALID_QUOTA = 10 * 1024 * 1024;
const PERSISTENCE_REQUEST_KEY = "gg-persistent-storage-requested";
const QUOTA_CLEANUP_THRESHOLD = 80;
const QUOTA_CLEANUP_TARGET = 65;
const REFETCHABLE_CACHE_GROUPS = [
  ["indexer-cache", "graphql-cache"],
  ["image-cache"],
  ["ipfs-cache"],
] as const;

export type PersistentStorageReason = "work-draft" | "offline-job";

export interface RefetchableStorageCleanupResult {
  beforePercentUsed: number;
  afterPercentUsed: number;
  deletedCaches: string[];
  clearedPersistedQueries: boolean;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check if the Storage API is available in the current environment.
 */
export function isStorageQuotaSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.estimate === "function"
  );
}

export async function requestPersistentStorageOnce(
  reason: PersistentStorageReason
): Promise<boolean | null> {
  if (
    typeof navigator === "undefined" ||
    typeof window === "undefined" ||
    !navigator.storage?.persist ||
    !navigator.storage?.persisted
  ) {
    return null;
  }

  try {
    if (window.localStorage.getItem(PERSISTENCE_REQUEST_KEY)) {
      return navigator.storage.persisted();
    }
    window.localStorage.setItem(PERSISTENCE_REQUEST_KEY, reason);
    if (await navigator.storage.persisted()) return true;
    const granted = await navigator.storage.persist();
    track("persistent_storage_requested", { reason, granted });
    return granted;
  } catch (error) {
    logger.warn("[StorageQuota] Persistent storage request failed", { error, reason });
    return null;
  }
}

export function isPersistedQueryClientExpired(
  client: Pick<PersistedClient, "timestamp">,
  currentTime = Date.now()
): boolean {
  return currentTime - client.timestamp > PERSIST_MAX_AGE;
}

async function clearExpiredPersistedQueryStorage(): Promise<boolean> {
  try {
    const persister = createQueryPersister({ dbName: "gg-react-query", storeName: "rq" });
    const persisted = await persister.restoreClient();
    if (!persisted || !isPersistedQueryClientExpired(persisted)) return false;
    await persister.removeClient();
    return true;
  } catch {
    return false;
  }
}

export async function cleanupRefetchableStorage(
  force = false
): Promise<RefetchableStorageCleanupResult> {
  const before = await getStorageQuota();
  const result: RefetchableStorageCleanupResult = {
    beforePercentUsed: before.percentUsed,
    afterPercentUsed: before.percentUsed,
    deletedCaches: [],
    clearedPersistedQueries: false,
  };
  if (!force && before.percentUsed < QUOTA_CLEANUP_THRESHOLD) return result;

  result.clearedPersistedQueries = await clearExpiredPersistedQueryStorage();
  let cleanupTargetReached = false;
  if (result.clearedPersistedQueries) {
    const afterQueries = await getStorageQuota();
    result.afterPercentUsed = afterQueries.percentUsed;
    cleanupTargetReached = afterQueries.percentUsed < QUOTA_CLEANUP_TARGET;
  }
  for (const cacheGroup of cleanupTargetReached ? [] : REFETCHABLE_CACHE_GROUPS) {
    if (typeof caches !== "undefined") {
      for (const cacheName of cacheGroup) {
        if (await caches.delete(cacheName)) result.deletedCaches.push(cacheName);
      }
    }
    const current = await getStorageQuota();
    result.afterPercentUsed = current.percentUsed;
    if (current.percentUsed < QUOTA_CLEANUP_TARGET) break;
  }

  track("storage_quota_cleanup", {
    before_percent_used: result.beforePercentUsed,
    after_percent_used: result.afterPercentUsed,
    deleted_caches: result.deletedCaches.join(","),
    cleared_persisted_queries: result.clearedPersistedQueries,
  });
  return result;
}

export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "QuotaExceededError"
    : error instanceof Error && error.name === "QuotaExceededError";
}

export async function retryOnceAfterQuotaCleanup<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    await cleanupRefetchableStorage(true);
    return operation();
  }
}

/**
 * Get current storage quota information.
 *
 * @param thresholds - Optional custom thresholds for low/critical warnings
 * @returns Storage quota information with usage statistics
 *
 * @example
 * ```typescript
 * const quota = await getStorageQuota();
 * if (quota.isCritical) {
 *   console.warn("Storage critically low:", quota.percentUsed.toFixed(1) + "%");
 * }
 * ```
 */
export async function getStorageQuota(
  thresholds: Partial<StorageQuotaThresholds> = {}
): Promise<StorageQuotaInfo> {
  const { lowThreshold = DEFAULT_LOW_THRESHOLD, criticalThreshold = DEFAULT_CRITICAL_THRESHOLD } =
    thresholds;

  // Return safe defaults if Storage API is not available
  if (!isStorageQuotaSupported()) {
    return {
      used: 0,
      quota: 0,
      percentUsed: 0,
      isLow: false,
      isCritical: false,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;

    // Calculate percentage, avoiding division by zero
    const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

    return {
      used,
      quota,
      percentUsed,
      isLow: percentUsed > lowThreshold,
      isCritical: percentUsed > criticalThreshold,
    };
  } catch (error) {
    // Log but don't throw - storage quota is informational
    logger.warn("[StorageQuota] Failed to get storage estimate", { error });
    return {
      used: 0,
      quota: 0,
      percentUsed: 0,
      isLow: false,
      isCritical: false,
    };
  }
}

/**
 * Check if there's enough storage space for a given size.
 *
 * @param requiredBytes - The amount of storage needed in bytes
 * @param safetyMargin - Additional safety margin (default: 10% of quota)
 * @returns True if enough space is available
 *
 * @example
 * ```typescript
 * const fileSize = 5 * 1024 * 1024; // 5MB
 * if (await hasEnoughStorage(fileSize)) {
 *   await saveFile(file);
 * } else {
 *   showStorageWarning();
 * }
 * ```
 */
export async function hasEnoughStorage(
  requiredBytes: number,
  safetyMargin: number = 0.1
): Promise<boolean> {
  const quota = await getStorageQuota();

  // If we can't determine quota, assume we have enough
  if (quota.quota === 0) return true;

  const availableBytes = quota.quota - quota.used;
  const safetyBuffer = quota.quota * safetyMargin;

  return availableBytes - safetyBuffer >= requiredBytes;
}

/**
 * Format bytes into a human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 */
export function formatBytes(bytes: number): string {
  // Guard against non-positive or non-finite values
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ============================================================================
// ANALYTICS & TRACKING
// ============================================================================

/**
 * Track storage quota status for analytics.
 * Call this on app start or periodically to monitor storage usage trends.
 *
 * @param source - Where this tracking was triggered from
 */
export async function trackStorageQuota(source: string = "unknown"): Promise<void> {
  try {
    const quota = await getStorageQuota();

    // Only track if we have valid quota data
    if (quota.quota < MIN_VALID_QUOTA) return;

    track("storage_quota_checked", {
      used_bytes: quota.used,
      quota_bytes: quota.quota,
      used_mb: Math.round(quota.used / (1024 * 1024)),
      quota_mb: Math.round(quota.quota / (1024 * 1024)),
      percent_used: Math.round(quota.percentUsed * 10) / 10,
      is_low: quota.isLow,
      is_critical: quota.isCritical,
      source,
    });

    // Track warning events separately for alerting
    if (quota.isCritical) {
      track("storage_quota_critical", {
        percent_used: Math.round(quota.percentUsed * 10) / 10,
        used_mb: Math.round(quota.used / (1024 * 1024)),
        quota_mb: Math.round(quota.quota / (1024 * 1024)),
        source,
      });
    } else if (quota.isLow) {
      track("storage_quota_low", {
        percent_used: Math.round(quota.percentUsed * 10) / 10,
        used_mb: Math.round(quota.used / (1024 * 1024)),
        quota_mb: Math.round(quota.quota / (1024 * 1024)),
        source,
      });
    }
  } catch (error) {
    logger.debug("[StorageQuota] Failed to track quota", { error });
  }
}

/**
 * Track a storage-related error with quota context.
 * Use this when a storage operation fails to include quota information
 * in the error report.
 *
 * @param error - The error that occurred
 * @param context - Additional context about the error
 */
export async function trackStorageErrorWithQuota(
  error: unknown,
  context: {
    source: string;
    userAction: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const quota = await getStorageQuota();

  trackStorageError(error, {
    source: context.source,
    userAction: context.userAction,
    metadata: {
      ...context.metadata,
      storage_used_bytes: quota.used,
      storage_quota_bytes: quota.quota,
      storage_percent_used: Math.round(quota.percentUsed * 10) / 10,
      storage_is_low: quota.isLow,
      storage_is_critical: quota.isCritical,
    },
  });
}
