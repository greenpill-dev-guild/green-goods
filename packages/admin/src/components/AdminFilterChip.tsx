import { type ComponentType } from "react";
import { cn } from "@green-goods/shared/utils/styles/cn";

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
 * AdminFilterChip — the cockpit's filter chip
 *
 * The installed app's chip at the cockpit's density (F4, DL-101):
 * - Height: 32px visual (h-8) with a 44px effective touch target (admin-hit-target)
 * - Shape: a capsule (--m3-shape-full), the app's chip shape
 * - Unselected: transparent fill, outline ring, on-surface-variant text
 * - Selected: the app's selected look in the workspace tone, a solid
 *   --tone-action fill with --tone-on-action text and no outline. As on the
 *   filled AdminButton, the neutral state layer paints beneath the label, and
 *   the focus ring stands 2px off the chip so it never merges with the fill.
 * - Selection shows by fill and `aria-pressed` alone, with no leading check mark,
 *   so choosing a chip never changes its width or moves the chips after it
 *   (DL-065). An optional leadingIcon shows in both states for the same reason.
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
        "h-8 rounded-[var(--m3-shape-full)]",
        // Typography
        "type-label font-medium whitespace-nowrap",
        // State layer + expanded 44px hit area (visual stays 32px)
        "m3-state-layer admin-hit-target",
        // Focus ring, offset so it reads against the selected fill
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2",
        // Motion
        "transition-colors duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
        // Disabled
        disabled && "pointer-events-none opacity-[0.38]",
        // State-based styles
        selected
          ? [
              // Selected: the workspace tone's action fill, no outline; the
              // default neutral ink layer paints beneath the label (Rule 18)
              "border border-transparent",
              "bg-[rgb(var(--tone-action,var(--primary-action)))]",
              "[color:rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
              "m3-state-layer-beneath",
            ]
          : [
              // Unselected: transparent fill with outline
              "border border-[rgb(var(--m3-outline))]",
              "bg-transparent",
              "text-[rgb(var(--m3-on-surface-variant))]",
              "[--state-layer-color:var(--m3-on-surface-variant)]",
            ],
        className
      )}
    >
      {LeadingIcon ? <LeadingIcon className="h-[18px] w-[18px] shrink-0" aria-hidden /> : null}

      <span>{label}</span>
    </button>
  );
}
