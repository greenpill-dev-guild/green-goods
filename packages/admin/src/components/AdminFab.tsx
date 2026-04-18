import { type ComponentType } from "react";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminFabProps {
  icon: ComponentType<{ className?: string }>;
  label?: string;
  onClick: () => void;
  size?: "small" | "standard" | "large";
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminFab — M3 Floating Action Button
 *
 * Implements Material Design 3 FAB anatomy in four configurations:
 * - small (40dp): corner-medium (12dp), h-6 w-6 icon
 * - standard (56dp, default): corner-large (16dp), h-6 w-6 icon
 * - large (96dp): corner-extra-large (28dp), h-9 w-9 icon
 * - extended (when label provided): standard height, auto width, label + icon
 *
 * Container: primary-container background
 * Icon/label: on-primary-container color
 * Elevation: elevation-3 base, elevation-4 on hover
 */
export function AdminFab({
  icon: Icon,
  label,
  onClick,
  size = "standard",
  className,
}: AdminFabProps) {
  const isExtended = Boolean(label);

  return (
    <button
      data-component="AdminFab"
      type="button"
      onClick={onClick}
      className={cn(
        // Base layout
        "inline-flex items-center justify-center shrink-0",
        // Container colors
        "bg-[rgb(var(--m3-primary-container))]",
        "text-[rgb(var(--m3-on-primary-container))]",
        // State layer
        "m3-state-layer [--state-layer-color:var(--m3-on-primary-container)]",
        // Elevation
        "shadow-[var(--m3-elevation-3)] hover:shadow-[var(--m3-elevation-4)]",
        // Transition
        "transition-shadow duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
        // Size + shape variants
        isExtended
          ? [
              // Extended: standard height, auto width, corner-large (16dp)
              "h-14 px-4 gap-3",
              "rounded-[var(--m3-shape-lg)]",
              "text-label-lg font-medium",
            ]
          : size === "small"
            ? [
                // Small: 40dp, corner-medium (12dp)
                "h-10 w-10",
                "rounded-[var(--m3-shape-md)]",
              ]
            : size === "large"
              ? [
                  // Large: 96dp, corner-extra-large (28dp)
                  "h-24 w-24",
                  "rounded-[var(--m3-shape-xl)]",
                ]
              : [
                  // Standard: 56dp, corner-large (16dp)
                  "h-14 w-14",
                  "rounded-[var(--m3-shape-lg)]",
                ],
        className
      )}
    >
      <Icon
        className={cn("shrink-0", size === "large" && !isExtended ? "h-9 w-9" : "h-6 w-6")}
        aria-hidden
      />
      {isExtended ? <span>{label}</span> : null}
    </button>
  );
}

AdminFab.displayName = "AdminFab";
