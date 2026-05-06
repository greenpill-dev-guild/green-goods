import { useIntl } from "react-intl";

interface TimeFilterControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
}

export function TimeFilterControl<T extends string>({
  value,
  onChange,
}: TimeFilterControlProps<T>) {
  const { formatMessage } = useIntl();
  return (
    <select
      className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      <option value={"day" as T}>
        {formatMessage({ id: "app.workDashboard.timeFilter.day", defaultMessage: "Day" })}
      </option>
      <option value={"week" as T}>
        {formatMessage({ id: "app.workDashboard.timeFilter.week", defaultMessage: "Week" })}
      </option>
      <option value={"month" as T}>
        {formatMessage({ id: "app.workDashboard.timeFilter.month", defaultMessage: "Month" })}
      </option>
      <option value={"year" as T}>
        {formatMessage({ id: "app.workDashboard.timeFilter.year", defaultMessage: "Year" })}
      </option>
    </select>
  );
}
