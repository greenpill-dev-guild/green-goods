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
      aria-label={formatMessage({
        id: "app.workDashboard.timeFilter.label",
        defaultMessage: "Time period",
      })}
      className="gg-control gg-control-select w-auto"
      data-size="sm"
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
