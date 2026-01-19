// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/temporal.d.ts" />

/**
 * Time Utilities (Temporal API)
 *
 * Modern time handling using the Temporal API.
 * Provides timezone-safe operations for dates, times, and durations.
 *
 * The Temporal API shipped in all major browsers by mid-2025, eliminating
 * the need for polyfills in production. This module provides:
 * - Timezone-safe date handling
 * - Accurate duration calculations
 * - Relative time formatting
 * - Backward-compatible Date conversion
 *
 * @module utils/time
 * @see https://tc39.es/proposal-temporal/docs/
 */

export type TimeFilter = "day" | "week" | "month" | "year";

// Duration constants for time filtering
const DURATION_MS: Record<TimeFilter, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Check if Temporal API is available
 */
export function isTemporalSupported(): boolean {
  return typeof Temporal !== "undefined" && typeof Temporal.Now?.instant === "function";
}

/**
 * Get timestamp cutoff for a given time filter
 *
 * @param filter - Time filter period
 * @returns Timestamp (ms) representing the cutoff point
 */
export function getTimeCutoff(filter: TimeFilter): number {
  if (isTemporalSupported()) {
    const now = Temporal.Now.instant();
    const durationMs = DURATION_MS[filter];
    const cutoff = now.subtract({ milliseconds: durationMs });
    return cutoff.epochMilliseconds;
  }

  // Fallback for environments without Temporal
  return Date.now() - DURATION_MS[filter];
}

/**
 * Normalize timestamp to milliseconds
 *
 * Handles both seconds (blockchain timestamps) and milliseconds timestamps.
 * Timestamps before ~2001 in milliseconds are assumed to be seconds.
 *
 * @param timestamp - Unix timestamp (seconds or milliseconds)
 * @returns Timestamp in milliseconds
 */
export function normalizeTimestamp(timestamp: number): number {
  // Timestamps below 1e12 are in seconds (before year ~2001 in ms)
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
  let ms: number;

  if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else if (typeof timestamp === "string") {
    ms = new Date(timestamp).getTime();
  } else {
    ms = normalizeTimestamp(timestamp);
  }

  if (Number.isNaN(ms)) return "just now";

  const diffMs = Date.now() - ms;

  if (diffMs < 0 || Number.isNaN(diffMs)) return "just now";

  const seconds = Math.floor(diffMs / 1000);
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
 * Creates a valid Temporal.Instant or returns null if the value is invalid.
 *
 * Handles seconds and milliseconds timestamps automatically.
 */
export function toSafeInstant(value: unknown): Temporal.Instant | null {
  if (!isTemporalSupported()) {
    // Return null if Temporal not available - callers should use toSafeDate
    return null;
  }

  if (value === null || value === undefined) return null;

  try {
    if (typeof value === "object" && value !== null && "epochMilliseconds" in value) {
      return value as Temporal.Instant;
    }

    const timestamp = typeof value === "string" ? Number(value) : value;
    if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return null;

    const ms = normalizeTimestamp(timestamp);
    return Temporal.Instant.fromEpochMilliseconds(ms);
  } catch {
    return null;
  }
}

/**
 * Creates a valid Date object or returns null if the value is invalid.
 *
 * Handles seconds and milliseconds timestamps automatically.
 * This is the backward-compatible version for code still using Date.
 */
export function toSafeDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  // Try Temporal first if available
  const instant = toSafeInstant(value);
  if (instant) {
    return new Date(instant.epochMilliseconds);
  }

  // Fallback to direct Date handling
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
  // Try Temporal-based formatting if available
  if (isTemporalSupported()) {
    const instant = toSafeInstant(value);
    if (instant) {
      try {
        const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
        return zonedDateTime.toLocaleString(undefined, options);
      } catch {
        // Fall through to Date-based formatting
      }
    }
  }

  // Fallback to Date-based formatting
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
  // Try Temporal-based formatting if available
  if (isTemporalSupported()) {
    const instant = toSafeInstant(value);
    if (instant) {
      try {
        const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
        return zonedDateTime.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          ...options,
        });
      } catch {
        // Fall through to Date-based formatting
      }
    }
  }

  // Fallback to Date-based formatting
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
  // Try Temporal-based formatting if available
  if (isTemporalSupported()) {
    const instant = toSafeInstant(value);
    if (instant) {
      try {
        const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
        // Format as YYYY-MM-DDTHH:mm for datetime-local inputs
        const iso = zonedDateTime.toString();
        return iso.slice(0, 16);
      } catch {
        // Fall through to Date-based formatting
      }
    }
  }

  // Fallback to Date-based formatting
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

  // Try Temporal-based parsing if available
  if (isTemporalSupported()) {
    try {
      const plainDateTime = Temporal.PlainDateTime.from(value);
      const zonedDateTime = plainDateTime.toZonedDateTime(Temporal.Now.timeZoneId());
      return new Date(zonedDateTime.epochMilliseconds);
    } catch {
      // Fall through to Date-based parsing
    }
  }

  // Fallback to Date-based parsing
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// ============================================================================
// TEMPORAL-SPECIFIC UTILITIES (new in 2026)
// ============================================================================

/**
 * Get start of day in UTC (useful for assessment dates)
 *
 * This eliminates the common "off by one day" bug when comparing dates
 * across timezones by normalizing to midnight UTC.
 */
export function getStartOfDayUTC(value: unknown): number | null {
  if (isTemporalSupported()) {
    const instant = toSafeInstant(value);
    if (!instant) return null;

    try {
      const zonedDateTime = instant.toZonedDateTimeISO("UTC");
      const startOfDay = zonedDateTime.with({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
      return startOfDay.epochMilliseconds;
    } catch {
      // Fall through to Date-based calculation
    }
  }

  // Fallback to Date-based calculation
  const date = toSafeDate(value);
  if (!date) return null;

  const utcDate = new Date(date);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate.getTime();
}

/**
 * Compare two timestamps (returns -1, 0, or 1)
 *
 * Useful for sorting and comparison operations.
 */
export function compareTimestamps(a: unknown, b: unknown): number {
  const msA = toSafeDate(a)?.getTime();
  const msB = toSafeDate(b)?.getTime();

  if (msA === undefined && msB === undefined) return 0;
  if (msA === undefined) return -1;
  if (msB === undefined) return 1;

  if (msA < msB) return -1;
  if (msA > msB) return 1;
  return 0;
}

/**
 * Calculate duration between two timestamps in milliseconds
 */
export function getDurationMs(start: unknown, end: unknown): number | null {
  const startMs = toSafeDate(start)?.getTime();
  const endMs = toSafeDate(end)?.getTime();

  if (startMs === undefined || endMs === undefined) return null;

  return endMs - startMs;
}

/**
 * Format a duration in milliseconds as human-readable string
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.abs(Math.floor(durationMs / 1000));

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

/**
 * Add duration to a timestamp
 *
 * @param timestamp - Base timestamp (ms)
 * @param duration - Duration to add
 * @returns New timestamp (ms)
 */
export function addDuration(
  timestamp: number,
  duration: {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
  }
): number {
  if (isTemporalSupported()) {
    try {
      const instant = Temporal.Instant.fromEpochMilliseconds(timestamp);
      const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());

      // Add calendar-based durations (years, months) separately from time-based
      let result = zonedDateTime;

      if (duration.years) {
        result = result.add({ years: duration.years });
      }
      if (duration.months) {
        result = result.add({ months: duration.months });
      }
      if (duration.weeks) {
        result = result.add({ weeks: duration.weeks });
      }
      if (duration.days) {
        result = result.add({ days: duration.days });
      }
      if (duration.hours) {
        result = result.add({ hours: duration.hours });
      }
      if (duration.minutes) {
        result = result.add({ minutes: duration.minutes });
      }
      if (duration.seconds) {
        result = result.add({ seconds: duration.seconds });
      }
      if (duration.milliseconds) {
        result = result.add({ milliseconds: duration.milliseconds });
      }

      return result.epochMilliseconds;
    } catch {
      // Fall through to simple calculation
    }
  }

  // Fallback: simple millisecond calculation (approximates months/years)
  let ms = timestamp;
  if (duration.years) ms += duration.years * 365 * 24 * 60 * 60 * 1000;
  if (duration.months) ms += duration.months * 30 * 24 * 60 * 60 * 1000;
  if (duration.weeks) ms += duration.weeks * 7 * 24 * 60 * 60 * 1000;
  if (duration.days) ms += duration.days * 24 * 60 * 60 * 1000;
  if (duration.hours) ms += duration.hours * 60 * 60 * 1000;
  if (duration.minutes) ms += duration.minutes * 60 * 1000;
  if (duration.seconds) ms += duration.seconds * 1000;
  if (duration.milliseconds) ms += duration.milliseconds;

  return ms;
}

/**
 * Get current timezone ID
 */
export function getCurrentTimezone(): string {
  if (isTemporalSupported()) {
    return Temporal.Now.timeZoneId();
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
