/**
 * Relative-time formatting.
 *
 * Split out of `time.ts` so the locale-aware path has one home: `time.ts` owns
 * absolute formatting, parsing, and range helpers, this file owns "how long
 * ago".
 */

import { normalizeTimestamp } from "./time";

/**
 * The bucketed age of a timestamp, as a negative value plus the unit it is
 * expressed in — the shape `Intl.RelativeTimeFormat` and react-intl's
 * `formatRelativeTime` consume directly.
 *
 * Returns `null` when the timestamp is invalid, in the future, or younger than
 * the 10-second "just now" floor. Callers supply their own localized string for
 * that case; there is no unit that expresses it.
 */
export function getRelativeTimeParts(
  timestamp: number | string | Date
): { value: number; unit: Intl.RelativeTimeFormatUnit } | null {
  let ms: number;

  if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else if (typeof timestamp === "string") {
    ms = new Date(timestamp).getTime();
  } else {
    ms = normalizeTimestamp(timestamp);
  }

  if (Number.isNaN(ms)) return null;

  const diffMs = Date.now() - ms;

  if (diffMs < 0 || Number.isNaN(diffMs)) return null;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return { value: -years, unit: "year" };
  if (months > 0) return { value: -months, unit: "month" };
  if (weeks > 0) return { value: -weeks, unit: "week" };
  if (days > 0) return { value: -days, unit: "day" };
  if (hours > 0) return { value: -hours, unit: "hour" };
  if (minutes > 0) return { value: -minutes, unit: "minute" };
  if (seconds > 10) return { value: -seconds, unit: "second" };
  return null;
}

/**
 * Format a timestamp to relative time (e.g., "2 hours ago", "3 days ago")
 *
 * Accepts seconds or milliseconds. Falls back to "just now" for very recent events.
 *
 * English-only by design — the strings are hardcoded. Inside a React tree,
 * prefer `getRelativeTimeParts` + react-intl's `formatRelativeTime` so the
 * value follows the active locale.
 */
export function formatRelativeTime(timestamp: number | string | Date): string {
  const parts = getRelativeTimeParts(timestamp);

  if (!parts) return "just now";

  const magnitude = Math.abs(parts.value);
  return `${magnitude} ${parts.unit}${magnitude > 1 ? "s" : ""} ago`;
}
