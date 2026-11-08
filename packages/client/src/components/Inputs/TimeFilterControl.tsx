import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import { useIntl } from "react-intl";

/** A list's time period: a span back from now, or any time at all. */
export type TimePeriod = TimeFilter | "any";

const PERIOD_LABELS: Record<TimePeriod, { id: string; defaultMessage: string }> = {
  any: { id: "app.workDashboard.timeFilter.any", defaultMessage: "Any time" },
  day: { id: "app.workDashboard.timeFilter.day", defaultMessage: "Day" },
  week: { id: "app.workDashboard.timeFilter.week", defaultMessage: "Week" },
  month: { id: "app.workDashboard.timeFilter.month", defaultMessage: "Month" },
  year: { id: "app.workDashboard.timeFilter.year", defaultMessage: "Year" },
};

/** Your Work's periods, from a day to a year. */
const TIME_FILTERS: readonly TimeFilter[] = ["day", "week", "month", "year"];

interface TimeFilterControlProps<T extends TimePeriod> {
  value: T;
  onChange: (value: T) => void;
  /** The periods offered, in order: only those the list's sources can answer in full. */
  periods?: readonly T[];
}

export function TimeFilterControl<T extends TimePeriod>({
  value,
  onChange,
  periods = TIME_FILTERS as readonly T[],
}: TimeFilterControlProps<T>) {
  const { formatMessage } = useIntl();
  return (
    <NativeSelect
      aria-label={formatMessage({
        id: "app.workDashboard.timeFilter.label",
        defaultMessage: "Time period",
      })}
      controlSize="compact"
      density="condensed"
      className="w-auto min-w-16 max-w-48 field-sizing-content"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {periods.map((period) => (
        <option key={period} value={period}>
          {formatMessage(PERIOD_LABELS[period])}
        </option>
      ))}
    </NativeSelect>
  );
}
