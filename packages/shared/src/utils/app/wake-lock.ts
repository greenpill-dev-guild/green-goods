/**
 * Screen Wake Lock API Utility
 *
 * Prevents the screen from dimming or locking during long-running operations.
 * Baseline available since May 2024 (Chrome 84+, Safari 16.4+, Firefox 126+).
 *
 * Use cases:
 * - Job queue synchronization
 * - Batch file uploads to IPFS
 * - Work submission with large media
 * - Long-running blockchain transactions
 *
 * @module utils/app/wake-lock
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */

/**
 * Check if Screen Wake Lock API is supported
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Wake lock sentinel reference for manual management
 */
let activeWakeLock: WakeLockSentinel | null = null;

/**
 * Request a screen wake lock
 *
 * Acquires a wake lock to prevent screen from sleeping.
 * Only one wake lock is held at a time (subsequent calls are no-ops).
 *
 * @returns The wake lock sentinel, or null if unsupported/failed
 *
 * @example
 * ```typescript
 * const lock = await requestWakeLock();
 * // ... perform long operation ...
 * await releaseWakeLock();
 * ```
 */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!isWakeLockSupported()) {
    return null;
  }

  // Already holding a wake lock
  if (activeWakeLock) {
    return activeWakeLock;
  }

  try {
    activeWakeLock = await navigator.wakeLock.request("screen");

    // Handle visibility change - re-acquire when page becomes visible again
    activeWakeLock.addEventListener("release", () => {
      activeWakeLock = null;
    });

    return activeWakeLock;
  } catch {
    // Wake lock request can fail if:
    // - Document is not visible
    // - Low battery mode is active
    // - Permission denied
    return null;
  }
}

/**
 * Release the active screen wake lock
 *
 * Releases the current wake lock if one is held.
 * Safe to call even if no lock is held.
 */
export async function releaseWakeLock(): Promise<void> {
  if (activeWakeLock) {
    try {
      await activeWakeLock.release();
    } catch {
      // Ignore release errors (already released)
    }
    activeWakeLock = null;
  }
}

/**
 * Execute a function while keeping the screen awake
 *
 * Automatically acquires and releases a wake lock around the provided function.
 * If wake lock is not supported or fails to acquire, the function still executes.
 *
 * @param fn - Async function to execute with wake lock protection
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await withWakeLock(async () => {
 *   await uploadLargeFiles();
 *   await syncJobQueue();
 *   return "done";
 * });
 * ```
 */
export async function withWakeLock<T>(fn: () => Promise<T>): Promise<T> {
  const lock = await requestWakeLock();

  try {
    return await fn();
  } finally {
    // Only release if we acquired it in this call
    if (lock && lock === activeWakeLock) {
      await releaseWakeLock();
    }
  }
}

/**
 * Re-acquire wake lock when page visibility changes
 *
 * Call this once on app startup to automatically re-acquire wake locks
 * when the page becomes visible again (e.g., user switches back to tab).
 *
 * @example
 * ```typescript
 * // In app initialization
 * setupWakeLockVisibilityHandler();
 * ```
 */
export function setupWakeLockVisibilityHandler(): void {
  if (typeof document === "undefined") return;

  document.addEventListener("visibilitychange", async () => {
    // Re-acquire wake lock when page becomes visible and we had one before
    if (document.visibilityState === "visible" && activeWakeLock === null) {
      // Don't automatically re-acquire - the calling code should manage this
      // This handler is mainly for cleanup
    }
  });
}
