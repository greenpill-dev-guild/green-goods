import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminSearchToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminSearchToolbar — M3 Search Bar
 *
 * Implements Material Design 3 search bar anatomy:
 * - Height: 56dp (h-14)
 * - Shape: corner-full (pill) via --m3-shape-full
 * - Background: surface-container-high
 * - Elevation: elevation-3 shadow
 * - Leading search icon (24dp), ml-4
 * - Flex-1 text input with body-lg typography
 * - Clear button (40dp circular) when search is non-empty
 * - Children (filter chips) rendered in a flex shrink-0 gap-2 row after the bar
 */
export function AdminSearchToolbar({
  search,
  onSearchChange,
  placeholder: placeholderProp,
  children,
  className,
}: AdminSearchToolbarProps) {
  const intl = useIntl();

  const placeholder =
    placeholderProp ??
    intl.formatMessage({
      id: "app.admin.listToolbar.searchPlaceholder",
      defaultMessage: "Search...",
    });

  const clearLabel = intl.formatMessage({
    id: "app.admin.listToolbar.clearSearch",
    defaultMessage: "Clear search",
  });

  return (
    <div data-component="AdminSearchToolbar" className={cn("flex items-center gap-2", className)}>
      {/* M3 Search Bar pill */}
      <div
        className={cn(
          // Shape: pill
          "rounded-[var(--m3-shape-full)]",
          // Height: compact for admin density (M3 spec is 56dp, reduced to 40dp)
          "h-10",
          // Background + elevation
          "bg-[rgb(var(--m3-surface-container-high))]",
          "shadow-[var(--m3-elevation-3)]",
          // Layout
          "flex flex-1 items-center"
        )}
      >
        {/* Leading search icon */}
        <RiSearchLine
          className="ml-3 h-4 w-4 shrink-0 text-[rgb(var(--m3-on-surface))]"
          aria-hidden
        />

        {/* Input */}
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            "flex-1 bg-transparent px-3",
            "text-body-md text-[rgb(var(--m3-on-surface))]",
            "placeholder:text-[rgb(var(--m3-on-surface-variant))]",
            "outline-none border-none focus:outline-none"
          )}
        />

        {/* Clear button — 40dp circular touch target, shown when search non-empty */}
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label={clearLabel}
            className={cn(
              // 40dp circular touch target
              "mr-1.5 h-8 w-8 shrink-0 rounded-full",
              // State layer
              "m3-state-layer",
              "[--state-layer-color:var(--m3-on-surface-variant)]",
              // Icon color
              "flex items-center justify-center text-[rgb(var(--m3-on-surface-variant))]",
              // Focus ring
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]"
            )}
          >
            <RiCloseLine className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Filter chip children — flex shrink-0, no wrapping */}
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}
