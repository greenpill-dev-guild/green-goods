import { cn } from "@green-goods/shared";
import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

interface ListToolbarProps {
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
          onChange={(e) => onSearchChange(e.target.value)}
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
