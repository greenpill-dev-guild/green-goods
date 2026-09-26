import { useCallback } from "react";
import { useIntl } from "react-intl";

import { getRelativeTimeParts } from "../../utils/relativeTime";
import { normalizeTimestamp } from "../../utils/time";

/** Past this age an event reads as its calendar date rather than "N days ago". */
const EVENT_AGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Formats an event age in the active locale.
 *
 * The plain `formatRelativeTime` util is English-only by design; inside a
 * React tree this is the locale-aware path. `numeric: "always"` keeps "1 day
 * ago" rather than "yesterday", so a column of ages reads uniformly, and the
 * sub-minute floor falls back to `numeric: "auto"` for "now" / "agora" /
 * "ahora" without needing a catalog key.
 */
export function useLocalizedRelativeTime(): (timestamp: number | string | Date) => string {
  const { formatRelativeTime } = useIntl();

  return useCallback(
    (timestamp: number | string | Date) => {
      const parts = getRelativeTimeParts(timestamp);
      return parts
        ? formatRelativeTime(parts.value, parts.unit, { numeric: "always" })
        : formatRelativeTime(0, "second", { numeric: "auto" });
    },
    [formatRelativeTime]
  );
}

/**
 * Formats when an event happened as a single date: its age within the last
 * week, then its calendar date, so a row never shows an age beside a date.
 * Returns undefined for an unknown time (0 or invalid), which rows omit.
 */
export function useLocalizedEventTime(): (timestamp: number) => string | undefined {
  const { formatDate } = useIntl();
  const formatAge = useLocalizedRelativeTime();

  return useCallback(
    (timestamp: number) => {
      const ms = normalizeTimestamp(timestamp);
      if (!timestamp || Number.isNaN(ms)) return undefined;
      return Date.now() - ms < EVENT_AGE_WINDOW_MS
        ? formatAge(ms)
        : formatDate(ms, { dateStyle: "medium" });
    },
    [formatAge, formatDate]
  );
}
