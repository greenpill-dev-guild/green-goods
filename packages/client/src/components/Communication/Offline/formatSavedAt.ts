import type { IntlShape } from "react-intl";

/**
 * When a saved copy was read, for an offline line: the time for today's saves
 * and a short date for older ones. Every list that shows a saved copy says it
 * the same way.
 */
export function formatSavedAt(intl: IntlShape, timestamp: number): string {
  const saved = new Date(timestamp);
  return saved.toDateString() === new Date().toDateString()
    ? intl.formatTime(saved, { hour: "numeric", minute: "2-digit" })
    : intl.formatDate(saved, { month: "short", day: "numeric" });
}
