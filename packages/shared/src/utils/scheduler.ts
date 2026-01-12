/**
 * Scheduler API Utilities
 *
 * Uses browser-native scheduler.postTask when available (Chrome 94+, Firefox 101+)
 * Falls back to setTimeout for older browsers (Safari polyfill ~1KB)
 *
 * This enables "cooperative scheduling" - background tasks yield to user interactions,
 * preventing UI jank during heavy operations like job queue flushing.
 *
 * @module utils/scheduler
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Scheduler
 */

import { releaseWakeLock, requestWakeLock } from "./app/wake-lock";

/**
 * Task priority levels (matches W3C Prioritized Task Scheduling spec)
 *
 * - 'user-blocking': Critical for user interaction (highest priority)
 * - 'user-visible': Affects what user sees but not blocking input
 * - 'background': Can be deferred, yields to user activity (lowest priority)
 */
export type TaskPriority = "user-blocking" | "user-visible" | "background";

interface SchedulerPostTaskOptions {
  priority?: TaskPriority;
  signal?: AbortSignal;
  delay?: number;
}

interface Scheduler {
  postTask<T>(callback: () => T | Promise<T>, options?: SchedulerPostTaskOptions): Promise<T>;
  yield?(): Promise<void>;
}

declare global {
  interface Window {
    scheduler?: Scheduler;
  }
}

/**
 * Check if native scheduler is available
 */
export function isSchedulerSupported(): boolean {
  return typeof window !== "undefined" && typeof window.scheduler?.postTask === "function";
}

/**
 * Schedule a task with the given priority
 *
 * Uses native scheduler.postTask when available for optimal scheduling.
 * Falls back to setTimeout-based scheduling for older browsers.
 *
 * @param callback - Function to execute
 * @param options - Scheduling options (priority, signal, delay)
 * @returns Promise resolving to callback result
 *
 * @example
 * ```typescript
 * // Process in background, yielding to user input
 * const result = await scheduleTask(
 *   () => expensiveComputation(),
 *   { priority: 'background' }
 * );
 * ```
 */
export async function scheduleTask<T>(
  callback: () => T | Promise<T>,
  options: SchedulerPostTaskOptions = {}
): Promise<T> {
  const { priority = "background", signal, delay = 0 } = options;

  // Check for abort before starting
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (isSchedulerSupported()) {
    return window.scheduler!.postTask(callback, { priority, signal, delay });
  }

  // Fallback implementation using setTimeout with Promise.withResolvers()
  const { promise, resolve, reject } = Promise.withResolvers<T>();

  // For background priority, add small delay to allow other tasks
  const fallbackDelay = delay + (priority === "background" ? 1 : 0);

  const timeoutId = setTimeout(async () => {
    try {
      const result = await callback();
      resolve(result);
    } catch (error) {
      reject(error as Error);
    }
  }, fallbackDelay);

  // Handle abort signal
  signal?.addEventListener("abort", () => {
    clearTimeout(timeoutId);
    reject(new DOMException("Aborted", "AbortError"));
  });

  return promise;
}

/**
 * Yield to the browser's main thread
 *
 * Allows pending user input and rendering to be processed.
 * Uses scheduler.yield() when available (Chrome 115+).
 *
 * @example
 * ```typescript
 * for (const item of items) {
 *   await processItem(item);
 *   await yieldToMain(); // Let browser handle any pending input
 * }
 * ```
 */
export async function yieldToMain(): Promise<void> {
  if (isSchedulerSupported() && typeof window.scheduler?.yield === "function") {
    return window.scheduler.yield();
  }

  // Fallback: yield via setTimeout(0) with Promise.withResolvers()
  // This moves to the back of the task queue
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}

/**
 * Process items in batches, yielding between batches
 *
 * Perfect for processing large arrays without blocking UI.
 * Each batch is scheduled as a background task that yields to user input.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Batch processing options
 * @returns Array of processed results
 *
 * @example
 * ```typescript
 * const results = await processBatched(
 *   jobs,
 *   async (job) => await syncJob(job),
 *   {
 *     batchSize: 3,
 *     priority: 'background',
 *     onProgress: (done, total) => console.log(`${done}/${total}`)
 *   }
 * );
 * ```
 */
export async function processBatched<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    /** Number of items per batch before yielding (default: 5) */
    batchSize?: number;
    /** Task priority (default: background) */
    priority?: TaskPriority;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** Progress callback */
    onProgress?: (processed: number, total: number) => void;
    /** Keep screen awake during processing (default: false) */
    keepAwake?: boolean;
  } = {}
): Promise<R[]> {
  const { batchSize = 5, priority = "background", signal, onProgress, keepAwake = false } = options;
  const results: R[] = [];

  // Acquire wake lock if requested to prevent screen sleep during long operations
  const wakeLock = keepAwake ? await requestWakeLock() : null;

  try {
    for (let i = 0; i < items.length; i++) {
      // Check for abort before each item
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Schedule each item's processing as a background task
      const result = await scheduleTask(() => processor(items[i], i), { priority, signal });
      results.push(result);

      // Yield after each batch to allow UI updates and user input
      if ((i + 1) % batchSize === 0 && i + 1 < items.length) {
        await yieldToMain();
        onProgress?.(i + 1, items.length);
      }
    }

    onProgress?.(items.length, items.length);
    return results;
  } finally {
    // Release wake lock when done
    if (wakeLock) {
      await releaseWakeLock();
    }
  }
}

/**
 * Run a function with idle priority
 *
 * Uses requestIdleCallback when available, falls back to setTimeout.
 * Best for truly non-essential work that can wait for idle time.
 *
 * @param callback - Function to run when idle
 * @param timeout - Maximum wait time in ms before forcing execution
 * @returns Promise resolving to callback result
 */
export async function runWhenIdle<T>(callback: () => T | Promise<T>, timeout = 5000): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();

  const run = async () => {
    try {
      resolve(await callback());
    } catch (error) {
      reject(error as Error);
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => run(), { timeout });
  } else {
    // Fallback for Safari (no requestIdleCallback)
    setTimeout(run, 1);
  }

  return promise;
}

/**
 * Debounce with scheduler-aware timing
 *
 * Creates a debounced function that schedules execution as a background task.
 * Useful for search inputs or resize handlers.
 *
 * @param fn - Function to debounce
 * @param delayMs - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounceWithScheduler<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      scheduleTask(() => fn(...args), { priority: "user-visible" });
      timeoutId = null;
    }, delayMs);
  };
}
