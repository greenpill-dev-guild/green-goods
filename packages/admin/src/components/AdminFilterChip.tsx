import { RiCheckLine } from "@remixicon/react";
import { type ComponentType } from "react";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminFilterChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leadingIcon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminFilterChip — M3 Filter Chip
 *
 * Implements Material Design 3 filter chip anatomy:
 * - Height: 32dp (h-8)
 * - Shape: corner-small (8dp) via --m3-shape-sm
 * - Unselected: transparent fill, outline ring, on-surface-variant text
 * - Selected: secondary-container fill, no outline, on-secondary-container text, leading checkmark
 * - Optional leadingIcon shown when unselected; replaced by RiCheckLine when selected
 * - Disabled: pointer-events-none opacity-38
 */
export function AdminFilterChip({
  label,
  selected,
  onToggle,
  leadingIcon: LeadingIcon,
  disabled = false,
  className,
}: AdminFilterChipProps) {
  return (
    <button
      data-component="AdminFilterChip"
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        // Shape & layout
        "inline-flex items-center gap-1.5 px-3",
        "h-8 rounded-[var(--m3-shape-sm)]",
        // Typography
        "text-label-lg font-medium whitespace-nowrap",
        // State layer
        "m3-state-layer",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
        // Motion
        "transition-colors duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
        // Disabled
        disabled && "pointer-events-none opacity-[0.38]",
        // State-based styles
        selected
          ? [
              // Selected: secondary-container fill, no outline
              "border border-transparent",
              "bg-[rgb(var(--m3-secondary-container))]",
              "text-[rgb(var(--m3-on-secondary-container))]",
              "[--state-layer-color:var(--m3-on-secondary-container)]",
            ]
          : [
              // Unselected: transparent fill with outline
              "border border-[rgb(var(--m3-outline))]",
              "bg-transparent",
              "text-[rgb(var(--m3-on-surface))]",
              "[--state-layer-color:var(--m3-on-surface-variant)]",
            ],
        className
      )}
    >
      {/* Leading icon: checkmark when selected, custom icon when unselected */}
      {selected ? (
        <RiCheckLine className="h-[18px] w-[18px] shrink-0" aria-hidden />
      ) : LeadingIcon ? (
        <LeadingIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      ) : null}

      <span>{label}</span>
    </button>
  );
}
