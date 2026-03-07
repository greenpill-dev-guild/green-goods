import { cn, selectTriggerVariants } from "@green-goods/shared";
import { RiArrowUpDownLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SortOption<T>[];
  "aria-label"?: string;
  className?: string;
}

export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SortSelectProps<T>) {
  const intl = useIntl();
  const resolvedAriaLabel =
    ariaLabel ??
    intl.formatMessage({ id: "app.admin.sortSelect.sortBy", defaultMessage: "Sort by" });
  return (
    <div className={cn("relative", className)}>
      <RiArrowUpDownLine className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={resolvedAriaLabel}
        className={cn(
          selectTriggerVariants({ size: "sm" }),
          "cursor-pointer appearance-none pl-9 pr-8"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
