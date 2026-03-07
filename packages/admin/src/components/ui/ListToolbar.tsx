import {
  cn,
  controlInputVariants,
  iconButtonIconVariants,
  iconButtonVariants,
} from "@green-goods/shared";
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
          className={cn(controlInputVariants({ size: "sm" }), "pl-9 pr-10")}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className={cn(
              iconButtonVariants({ size: "sm", tone: "ghost" }),
              "absolute right-1 top-1/2 -translate-y-1/2"
            )}
            aria-label={intl.formatMessage({
              id: "app.admin.listToolbar.clearSearch",
              defaultMessage: "Clear search",
            })}
          >
            <RiCloseLine className={iconButtonIconVariants({ size: "sm" })} />
          </button>
        )}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
