import { useCallback } from "react";
import { useIntl } from "react-intl";

import { getRelativeTimeParts } from "../../utils/relativeTime";

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
