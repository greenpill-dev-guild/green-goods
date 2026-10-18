import { getRelativeTimeParts } from "@green-goods/shared/utils/relativeTime";
import type { IntlShape } from "react-intl";

/**
 * How long ago, in the reader's language: "2 hours ago", "1 day ago", "just now". Always a number,
 * never "yesterday", so these rows word an age as the work row and the cockpit's work card do.
 */
export function formatAgo(intl: IntlShape, at: number): string {
  const parts = getRelativeTimeParts(at);
  return parts
    ? intl.formatRelativeTime(parts.value, parts.unit, { numeric: "always" })
    : intl.formatMessage({ id: "app.pending.meta.justNow", defaultMessage: "just now" });
}

/** The same, standing alone at the start of a line: "Hace 1 día". */
export function formatAgoStandalone(intl: IntlShape, at: number): string {
  const text = formatAgo(intl, at);
  return text.charAt(0).toLocaleUpperCase(intl.locale) + text.slice(1);
}

/** A day on a row's meta line: "Oct 2". */
export function formatRowDay(intl: IntlShape, at: number): string {
  return intl.formatDate(at, { month: "short", day: "numeric" });
}

/** When something was saved on this phone: "Saved today · 9:40 AM", "Saved Oct 4 · 6:12 PM". */
export function formatSavedMeta(intl: IntlShape, at: number): string {
  const time = intl.formatTime(at, { hour: "numeric", minute: "2-digit" });
  return new Date(at).toDateString() === new Date().toDateString()
    ? intl.formatMessage(
        { id: "app.pending.meta.savedToday", defaultMessage: "Saved today · {time}" },
        { time }
      )
    : intl.formatMessage(
        { id: "app.pending.meta.saved", defaultMessage: "Saved {date} · {time}" },
        { date: formatRowDay(intl, at), time }
      );
}
