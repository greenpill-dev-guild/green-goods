import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared";

// ============================================================================
// Variant System
// ============================================================================

export const adminCardVariants = tv({
  base: [
    // Shape: corner-medium (12dp)
    "rounded-[var(--m3-shape-md)]",
    // Padding
    "p-4",
    // Transition
    "transition-shadow duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
  ],
  variants: {
    variant: {
      // Filled — surface-container-highest, no outline, elevation 0→1 on hover
      filled: ["bg-[rgb(var(--m3-surface-container-highest))]", "shadow-[var(--m3-elevation-0)]"],
      // Elevated — surface-container-low, elevation 1 base
      elevated: ["bg-[rgb(var(--m3-surface-container-low))]", "shadow-[var(--m3-elevation-1)]"],
      // Outlined — surface, no elevation, ring outline
      outlined: [
        "bg-[rgb(var(--m3-surface))]",
        "shadow-[var(--m3-elevation-0)]",
        "ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))]",
      ],
    },
    interactive: {
      true: ["m3-state-layer", "cursor-pointer", "[--state-layer-color:var(--m3-on-surface)]"],
      false: [],
    },
  },
  compoundVariants: [
    // Interactive filled: hover goes 0→1
    {
      variant: "filled",
      interactive: true,
      class: "hover:shadow-[var(--m3-elevation-1)]",
    },
    // Interactive elevated: hover goes 1→2
    {
      variant: "elevated",
      interactive: true,
      class: "hover:shadow-[var(--m3-elevation-2)]",
    },
    // Interactive outlined: hover goes 0→1
    {
      variant: "outlined",
      interactive: true,
      class: "hover:shadow-[var(--m3-elevation-1)]",
    },
  ],
  defaultVariants: {
    variant: "elevated",
    interactive: false,
  },
});

// ============================================================================
// Types
// ============================================================================

type AdminCardVariantProps = VariantProps<typeof adminCardVariants>;

export interface AdminCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    AdminCardVariantProps {
  interactive?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminCard — M3 Card
 *
 * Implements Material Design 3 card anatomy with three variants:
 * - filled: surface-container-highest background, no outline, elevation 0→1
 * - elevated: surface-container-low background, elevation 1→2
 * - outlined: surface background, ring-1 outline-variant, elevation 0→1
 *
 * The interactive prop adds state layer + cursor-pointer + hover elevation upgrade.
 */
export function AdminCard({
  className,
  variant,
  interactive = false,
  children,
  style,
  ...props
}: AdminCardProps) {
  // Handoff DESIGN_NOTES § Tone system: per-view canvas wash extends to cards
  // as a barely-perceptible tint (~3%) layered on top of the M3 surface. The
  // tint paint moved to a `::before` layer in `admin-m3-overrides.css` so
  // pages with hundreds of cards (Hub queues, action templates) don't pay a
  // per-element `background-image` paint. The `relative` here makes the
  // pseudo's `inset:0` resolve against the card box.
  return (
    <div
      data-component="AdminCard"
      className={cn("relative", adminCardVariants({ variant, interactive }), className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

AdminCard.displayName = "AdminCard";
