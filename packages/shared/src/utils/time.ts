/**
 * Time Utilities
 *
 * Shared utilities for time-based filtering and calculations.
 *
 * @module utils/time
 */

export type TimeFilter = "day" | "week" | "month" | "year";

/**
 * Get timestamp cutoff for a given time filter
 *
 * @param filter - Time filter period
 * @returns Timestamp (ms) representing the cutoff point
 */
export function getTimeCutoff(filter: TimeFilter): number {
  const now = Date.now();
  const durations: Record<TimeFilter, number> = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  return now - durations[filter];
}

/**
 * Normalize timestamp to milliseconds
 *
 * Handles both seconds and milliseconds timestamps.
 *
 * @param timestamp - Unix timestamp (seconds or milliseconds)
 * @returns Timestamp in milliseconds
 */
export function normalizeTimestamp(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

/**
 * Filter items by time range
 *
 * @param items - Items with createdAt timestamp
 * @param filter - Time filter period
 * @returns Filtered items within the time range
 */
export function filterByTimeRange<T extends { createdAt: number }>(
  items: T[],
  filter: TimeFilter
): T[] {
  const cutoff = getTimeCutoff(filter);
  return items.filter((item) => normalizeTimestamp(item.createdAt) >= cutoff);
}

/**
 * Sort items by creation time (newest first)
 */
export function sortByCreatedAt<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}
