import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../utils/styles/cn";

/* ============================================================================
 * Surface — Unified surface primitive for the Green Goods design system.
 *
 * Replaces: CardBase, SurfaceCard, .surface-section, .surface-inset, .surface-card
 *
 * Elevation variants map to M3 tonal elevation + shadow depth:
 *   ground   → recessed into canvas (bg-bg-weak, no shadow)
 *   raised   → the card level: the one card surface (.gg-card, F7) on its
 *              24px corner, in both its glass and solid names
 *   floating → popover/dropdown (bg-bg-white, elevation-3)
 *   overlay  → sheet/modal level (bg-bg-white, elevation-5)
 *
 * Usage:
 *   <Surface elevation="raised" padding="default">
 *     <Surface.Header>Title</Surface.Header>
 *     <Surface.Body>Content</Surface.Body>
 *   </Surface>
 * ============================================================================ */

export const surfaceVariants = tv({
  variants: {
    elevation: {
      // Glass tiers (M3 + Liquid)
      ground: "glass-ground",
      raised: "gg-card",
      floating: "glass-floating",
      overlay: "glass-overlay",
      // Solid variants (for non-glass contexts: form content, data tables)
      "solid-ground": "bg-bg-weak shadow-[var(--edge-rest)]",
      "solid-raised": "gg-card",
      "solid-floating": "bg-bg-white shadow-[var(--edge-rest),_var(--m3-elevation-2)]",
      "solid-overlay": "bg-bg-white shadow-[var(--m3-elevation-2)]",
    },
    padding: {
      none: "",
      compact: "p-3",
      default: "p-4 sm:p-5",
      spacious: "p-6 sm:p-8",
    },
    // `card` is the card's own corner on the raised level and 16px elsewhere.
    radius: {
      card: "",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
    interactive: {
      true: [
        "cursor-pointer",
        "transition-[box-shadow,transform] duration-[var(--spring-spatial-fast-duration,200ms)] ease-[var(--spring-spatial-fast-easing,ease-out)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--m3-elevation-2)]",
        "active:translate-y-0 active:scale-[0.992]",
      ].join(" "),
      false: "",
    },
  },
  defaultVariants: {
    elevation: "raised",
    padding: "none",
    radius: "card",
    interactive: false,
  },
  compoundVariants: [
    {
      elevation: [
        "ground",
        "floating",
        "overlay",
        "solid-ground",
        "solid-floating",
        "solid-overlay",
      ],
      radius: "card",
      class: "rounded-lg",
    },
    {
      interactive: true,
      elevation: "raised",
      class: "hover:shadow-[var(--m3-elevation-2)] active:shadow-[var(--m3-elevation-1)]",
    },
  ],
});

export type SurfaceVariantProps = VariantProps<typeof surfaceVariants>;

type ColorAccent = "primary" | "success" | "warning" | "error" | "info";

const colorAccentMap: Record<ColorAccent, string> = {
  primary: "border-l-2 border-l-primary-base",
  success: "border-l-2 border-l-success-base",
  warning: "border-l-2 border-l-warning-base",
  error: "border-l-2 border-l-error-base",
  info: "border-l-2 border-l-information-base",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement>, SurfaceVariantProps {
  colorAccent?: ColorAccent;
  as?: React.ElementType;
}

const SurfaceRoot = React.forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      className,
      elevation,
      padding,
      radius,
      interactive,
      colorAccent,
      as: Component = "div",
      ...props
    },
    ref
  ) => (
    <Component
      ref={ref}
      className={cn(
        surfaceVariants({ elevation, padding, radius, interactive }),
        colorAccent && colorAccentMap[colorAccent],
        className
      )}
      {...props}
    />
  )
);
SurfaceRoot.displayName = "Surface";

const SurfaceHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b border-stroke-soft px-4 py-3 sm:px-5 sm:py-4",
        className
      )}
      {...props}
    />
  )
);
SurfaceHeader.displayName = "Surface.Header";

const SurfaceBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 sm:p-5", className)} {...props} />
  )
);
SurfaceBody.displayName = "Surface.Body";

const SurfaceFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center border-t border-stroke-soft px-4 py-3 sm:px-5 sm:py-4",
        className
      )}
      {...props}
    />
  )
);
SurfaceFooter.displayName = "Surface.Footer";

export const Surface = Object.assign(SurfaceRoot, {
  Header: SurfaceHeader,
  Body: SurfaceBody,
  Footer: SurfaceFooter,
});
