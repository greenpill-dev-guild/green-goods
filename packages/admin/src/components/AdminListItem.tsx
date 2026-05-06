import { type ComponentType, type ReactNode } from "react";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminListItemProps {
  label: string;
  supportingText?: string;
  overline?: string;
  leadingIcon?: ComponentType<{ className?: string }>;
  leadingImageSrc?: string | null;
  trailingText?: string;
  trailingIcon?: ComponentType<{ className?: string }>;
  trailingContent?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Line count detection
// ============================================================================

/** Derives the M3 line count (1, 2, or 3) from the item's content. */
function getLineCount(overline: string | undefined, supportingText: string | undefined): 1 | 2 | 3 {
  if (overline || (supportingText && supportingText.length > 60)) return 3;
  if (supportingText) return 2;
  return 1;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminListItem — M3 List Item
 *
 * Implements Material Design 3 list item anatomy:
 * - 1-line: min-h-[56px] — label only
 * - 2-line: min-h-[72px] — label + supportingText (≤60 chars)
 * - 3-line: min-h-[88px] — label + overline OR long supportingText (>60 chars)
 *
 * Auto-detects line count from content. Renders as <button> when onClick is
 * provided, otherwise as <div>.
 */
export function AdminListItem({
  label,
  supportingText,
  overline,
  leadingIcon: LeadingIcon,
  leadingImageSrc,
  trailingText,
  trailingIcon: TrailingIcon,
  trailingContent,
  selected = false,
  disabled = false,
  onClick,
  className,
}: AdminListItemProps) {
  const lines = getLineCount(overline, supportingText);

  const containerClasses = cn(
    // Layout
    "flex w-full items-center gap-4 px-4",
    // Shape: corner-none (no border-radius)
    "rounded-none",
    // Background
    "bg-transparent",
    // Height by line count
    lines === 1 && "min-h-[56px]",
    lines === 2 && "min-h-[72px]",
    lines === 3 && "min-h-[88px]",
    // State layer
    "m3-state-layer",
    "[--state-layer-color:var(--m3-on-surface)]",
    // Selected
    selected && "bg-[rgb(var(--m3-primary)/0.08)]",
    // Disabled
    disabled && "pointer-events-none opacity-[0.38]",
    // Interactive
    onClick && "cursor-pointer",
    className
  );

  // -------------------------------------------------------------------------
  // Leading slot
  // -------------------------------------------------------------------------

  const leadingSlot = (() => {
    if (leadingImageSrc) {
      return (
        <img
          src={leadingImageSrc}
          alt=""
          aria-hidden="true"
          className="h-14 w-14 shrink-0 object-cover"
        />
      );
    }
    if (LeadingIcon) {
      return (
        <LeadingIcon
          className="h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
          aria-hidden
        />
      );
    }
    return null;
  })();

  // -------------------------------------------------------------------------
  // Trailing slot
  // -------------------------------------------------------------------------

  const trailingSlot = (() => {
    if (trailingContent) {
      return <>{trailingContent}</>;
    }
    if (TrailingIcon) {
      return (
        <TrailingIcon
          className="h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
          aria-hidden
        />
      );
    }
    if (trailingText) {
      return (
        <span className="shrink-0 text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          {trailingText}
        </span>
      );
    }
    return null;
  })();

  // -------------------------------------------------------------------------
  // Text content
  // -------------------------------------------------------------------------

  const textContent = (
    <div className="min-w-0 flex-1">
      {overline ? (
        <p
          className="truncate text-label-sm text-[rgb(var(--m3-on-surface-variant))]"
          title={overline}
        >
          {overline}
        </p>
      ) : null}

      <p className="truncate text-body-lg text-[rgb(var(--m3-on-surface))]" title={label}>
        {label}
      </p>

      {supportingText ? (
        <p
          className={cn(
            "text-body-md text-[rgb(var(--m3-on-surface-variant))]",
            lines === 3 ? "line-clamp-2" : "truncate"
          )}
          title={supportingText}
        >
          {supportingText}
        </p>
      ) : null}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render — button or div
  // -------------------------------------------------------------------------

  if (onClick) {
    return (
      <button
        data-component="AdminListItem"
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={containerClasses}
      >
        {leadingSlot}
        {textContent}
        {trailingSlot}
      </button>
    );
  }

  return (
    <div data-component="AdminListItem" className={containerClasses}>
      {leadingSlot}
      {textContent}
      {trailingSlot}
    </div>
  );
}

AdminListItem.displayName = "AdminListItem";
