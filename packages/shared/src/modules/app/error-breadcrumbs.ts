import { logger } from "./logger";

const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

// ============================================================================
// BREADCRUMB TRAIL
// ============================================================================

export interface BreadcrumbEntry {
  /** When the action occurred */
  timestamp: number;
  /** What the user did */
  action: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 20;
const breadcrumbs: BreadcrumbEntry[] = [];

/**
 * Add a breadcrumb to track user actions before an error.
 * Breadcrumbs are included in error reports to help debug.
 */
export function addBreadcrumb(action: string, data?: Record<string, unknown>): void {
  breadcrumbs.push({
    timestamp: Date.now(),
    action,
    data,
  });

  // Keep only the most recent breadcrumbs
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }

  if (IS_DEBUG) {
    logger.info(`[ErrorTracking] Breadcrumb: ${action}`, data);
  }
}

/**
 * Get recent breadcrumbs for error context.
 */
export function getBreadcrumbs(): BreadcrumbEntry[] {
  return [...breadcrumbs];
}

/**
 * Clear all breadcrumbs (e.g., on logout).
 */
export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}
