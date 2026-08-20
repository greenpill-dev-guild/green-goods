import { getRelativeTimeParts } from "@green-goods/shared/utils";
import { useIntl } from "react-intl";

/**
 * Relative event age through react-intl so es/pt operators don't get English.
 *
 * The shared `formatRelativeTime` helper is English-only by design; inside a
 * React tree the locale-aware path is `getRelativeTimeParts` plus react-intl.
 * `numeric: "always"` keeps "1 day ago" rather than "yesterday" so a column of
 * ages reads uniformly; the sub-minute fallback uses `numeric: "auto"` to get
 * "now" / "agora" / "ahora" without a dedicated catalog key.
 */
export function useLocalizedRelativeTime(): (timestamp: number | string | Date) => string {
  const { formatRelativeTime } = useIntl();

  return (timestamp) => {
    const parts = getRelativeTimeParts(timestamp);
    return parts
      ? formatRelativeTime(parts.value, parts.unit, { numeric: "always" })
      : formatRelativeTime(0, "second", { numeric: "auto" });
  };
}
