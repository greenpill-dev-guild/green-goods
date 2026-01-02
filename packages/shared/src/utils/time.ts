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

/**
 * Format a timestamp to relative time (e.g., "2 hours ago", "3 days ago")
 *
 * Accepts seconds or milliseconds. Falls back to "just now" for very recent events.
 */
export function formatRelativeTime(timestamp: number | string | Date): string {
  const date =
    typeof timestamp === "string" || timestamp instanceof Date
      ? new Date(timestamp)
      : new Date(normalizeTimestamp(timestamp));

  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) return "just now";

  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (seconds > 10) return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  return "just now";
}

/**
 * Creates a valid Date object or returns null if the value is invalid.
 *
 * Handles seconds and milliseconds timestamps automatically.
 */
export function toSafeDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  const timestamp = typeof value === "string" ? Number(value) : value;
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return null;

  const ms = normalizeTimestamp(timestamp);
  const date = new Date(ms);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date value safely, returning a fallback string if invalid.
 */
export function formatDate(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "Invalid date"
): string {
  const date = toSafeDate(value);
  if (!date) return fallback;

  try {
    return date.toLocaleDateString(undefined, options);
  } catch {
    return fallback;
  }
}

/**
 * Formats a datetime value safely with date and time, returning a fallback if invalid.
 */
export function formatDateTime(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "Invalid date"
): string {
  const date = toSafeDate(value);
  if (!date) return fallback;

  try {
    return date.toLocaleString(undefined, options);
  } catch {
    return fallback;
  }
}

/**
 * Formats a date for datetime-local input value (YYYY-MM-DDTHH:mm).
 * Returns empty string if invalid (inputs handle empty gracefully).
 */
export function toDateTimeLocalValue(value: unknown): string {
  const date = toSafeDate(value);
  if (!date) return "";

  try {
    return date.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

/**
 * Creates a Date from datetime-local input value, or returns current date if invalid.
 */
export function fromDateTimeLocalValue(value: string): Date {
  if (!value) return new Date();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
