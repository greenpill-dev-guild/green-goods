import { RiArrowUpDownLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "../utils/styles/cn";
import { Button, type ButtonProps } from "./Button";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ButtonProps & { label: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-text-soft">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-strong">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-sub">{description}</p>}
      {action && (
        <Button className="mt-4" size="sm" {...action}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  className?: string;
}

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  className,
}: ListToolbarProps) {
  const intl = useIntl();
  const placeholder =
    searchPlaceholder ??
    intl.formatMessage({
      id: "app.admin.listToolbar.searchPlaceholder",
      defaultMessage: "Search...",
    });

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-stroke-soft bg-bg-white pl-9 pr-8 text-sm text-text-strong placeholder:text-text-disabled focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-soft hover:text-text-strong"
            aria-label={intl.formatMessage({
              id: "app.admin.listToolbar.clearSearch",
              defaultMessage: "Clear search",
            })}
          >
            <RiCloseLine className="h-4 w-4" />
          </button>
        )}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export interface SortSelectProps<T extends string> {
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
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={resolvedAriaLabel}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-stroke-soft bg-bg-white pl-8 pr-8 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
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
