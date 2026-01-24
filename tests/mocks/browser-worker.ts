/**
 * MSW Browser Worker Setup for E2E Tests
 *
 * Provides browser-based MSW worker for mocking network requests during
 * Playwright E2E tests. This enables testing passkey flows and blockchain
 * interactions without real backend services.
 *
 * Usage in E2E tests:
 * 1. Import this module in Playwright global setup
 * 2. Call `startMockWorker()` before tests
 * 3. Call `stopMockWorker()` after tests
 *
 * @example
 * ```typescript
 * // In Playwright global setup
 * import { startMockWorker } from './mocks/browser-worker';
 *
 * export default async function globalSetup() {
 *   await startMockWorker();
 * }
 * ```
 */

import { setupWorker, type SetupWorker } from "msw/browser";
import { pimlicoHandlers, resetPimlicoMocks } from "./pimlico-handlers";

// ============================================================================
// WORKER INSTANCE
// ============================================================================

let worker: SetupWorker | null = null;

// ============================================================================
// WORKER LIFECYCLE
// ============================================================================

/**
 * Start the MSW worker for browser-based mocking
 *
 * @param options - Worker options
 * @returns Promise that resolves when worker is ready
 */
export async function startMockWorker(
  options: {
    /** Log unhandled requests (default: bypass) */
    onUnhandledRequest?: "bypass" | "warn" | "error";
    /** Custom service worker URL (default: /mockServiceWorker.js) */
    serviceWorkerUrl?: string;
  } = {}
): Promise<void> {
  if (worker) {
    console.warn("[MSW] Worker already started");
    return;
  }

  // Create worker with all handlers
  worker = setupWorker(...pimlicoHandlers);

  // Start the worker
  await worker.start({
    onUnhandledRequest: options.onUnhandledRequest ?? "bypass",
    serviceWorker: {
      url: options.serviceWorkerUrl ?? "/mockServiceWorker.js",
    },
    // Quiet mode in tests
    quiet: true,
  });

  console.log("[MSW] Browser worker started");
}

/**
 * Stop the MSW worker
 */
export function stopMockWorker(): void {
  if (!worker) {
    console.warn("[MSW] Worker not started");
    return;
  }

  worker.stop();
  worker = null;
  console.log("[MSW] Browser worker stopped");
}

/**
 * Reset all mock state (useful between tests)
 */
export function resetMocks(): void {
  resetPimlicoMocks();
  console.log("[MSW] Mocks reset");
}

/**
 * Get the current worker instance
 */
export function getWorker(): SetupWorker | null {
  return worker;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { pimlicoHandlers } from "./pimlico-handlers";
