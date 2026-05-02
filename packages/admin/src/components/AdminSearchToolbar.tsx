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
 * Implements compact Material Design 3 list toolbar anatomy:
 * - Height: 40dp (h-10) to align with chips and icon buttons
 * - Shape: corner-full (pill) via --m3-shape-full
 * - Background: surface-container with outline
 * - Leading search icon (20dp), ml-3
 * - Flex-1 text input with body-md typography
 * - Clear button (32dp circular) when search is non-empty
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
    <div
      data-component="AdminSearchToolbar"
      className={cn("flex w-full flex-col gap-2 sm:flex-row sm:items-center", className)}
    >
      {/* Compact M3 Search Bar pill */}
      <div
        className={cn(
          // Shape: pill
          "rounded-[var(--m3-shape-full)]",
          // Height aligns with chips and toolbar icon buttons.
          "h-10 min-w-0",
          // Background + outline
          "border border-[rgb(var(--m3-outline-variant))]",
          "bg-[rgb(var(--m3-surface-container))]",
          // Layout
          "flex w-full items-center sm:flex-1"
        )}
      >
        {/* Leading search icon — 18dp keeps the pill from reading as a heavy
            "submission" button. Was 20dp; M3 list-toolbar spec accepts 18-20dp. */}
        <RiSearchLine
          className="ml-3 h-[18px] w-[18px] shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
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
            "h-full min-w-0 flex-1 bg-transparent px-3",
            "text-body-md text-[rgb(var(--m3-on-surface))]",
            "placeholder:text-[rgb(var(--m3-on-surface-variant))]",
            "outline-none border-none focus:outline-none"
          )}
        />

        {/* Clear button — 32dp circular control, shown when search non-empty */}
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label={clearLabel}
            className={cn(
              // 32dp circular control
              "mr-1 h-8 w-8 shrink-0 rounded-full",
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

      {/* Filter chip children — wrap below on narrow canvases. */}
      {children ? (
        <div className="flex min-h-10 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
