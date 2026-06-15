import { NativeSelect } from "@green-goods/shared";
import { useIntl } from "react-intl";

export interface AdminSortOption {
  value: string;
  label: string;
}

export interface AdminSortSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AdminSortOption[];
  /** Leading label; defaults to the shared "Sort by" string. */
  label?: string;
  /** Accessible name for the select; defaults to the resolved label. */
  ariaLabel?: string;
}

/**
 * AdminSortSelect — the canonical "Sort by" pill.
 *
 * Extracted from Hub's inline control so Hub and Actions can't drift: an
 * `h-10` M3 pill (matching the `AdminSearchToolbar` search field height) with
 * a `whitespace-nowrap` label and a borderless `NativeSelect` at the same
 * `text-body-md` weight as the surrounding controls. Drop it inside an
 * `AdminSearchToolbar`'s children, alongside filter chips.
 */
export function AdminSortSelect({
  value,
  onChange,
  options,
  label,
  ariaLabel,
}: AdminSortSelectProps) {
  const { formatMessage } = useIntl();
  const resolvedLabel =
    label ?? formatMessage({ id: "app.admin.sortSelect.sortBy", defaultMessage: "Sort by" });

  return (
    <label
      data-component="AdminSortSelect"
      className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container))] pl-3 pr-2 text-body-md text-[rgb(var(--m3-on-surface-variant))]"
    >
      <span className="whitespace-nowrap">{resolvedLabel}</span>
      <NativeSelect
        surface="admin"
        // `md` (not `sm`) so the value renders at 16px to match the
        // AdminSearchToolbar search field — `sm` reads 11px, the size
        // mismatch QA flagged. (A `text-body-md` utility here would be
        // dropped by tailwind-merge against the color class, so the size
        // comes from the control token, not a utility.)
        controlSize="md"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel ?? resolvedLabel}
        className="h-full min-h-0 rounded-full border-0 bg-transparent py-0 pl-1 pr-8 text-text-strong shadow-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
