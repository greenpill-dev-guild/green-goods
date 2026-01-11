// react import removed; not needed for TSX with new JSX transform

interface TimeFilterControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
}

export function TimeFilterControl<T extends string>({
  value,
  onChange,
}: TimeFilterControlProps<T>) {
  return (
    <select
      className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0 capitalize"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      <option value={"day" as T}>day</option>
      <option value={"week" as T}>week</option>
      <option value={"month" as T}>month</option>
      <option value={"year" as T}>year</option>
    </select>
  );
}
