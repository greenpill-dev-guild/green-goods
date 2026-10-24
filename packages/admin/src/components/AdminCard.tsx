import { cn } from "@green-goods/shared/utils/styles/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

// ============================================================================
// Variant System
// ============================================================================

const adminCardVariants = tv({
  base: [
    // The one card surface (.gg-card in shared theme.css, F7): the card's fill,
    // a 1px edge, a faint shadow and the 24px corner, the installed app's card.
    "gg-card",
    // Transition
    "transition-shadow duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
  ],
  variants: {
    variant: {
      // Filled — a tinted card on the card's corner: surface-container-highest,
      // no edge and no shadow (the app's information card).
      filled: ["border-0 shadow-none", "bg-[rgb(var(--m3-surface-container-highest))]"],
      // Elevated — the card on the canvas, as the card surface draws it.
      elevated: [],
      // Outlined — the same card: the card surface already draws its edge.
      outlined: [],
    },
    // One density ladder instead of per-view `className="p-3"` overrides:
    // default = card padding (16dp), compact = dense stat/list tiles (12dp),
    // none = flush wrapper for edge-to-edge content (tables, media, lists).
    density: {
      default: "p-4",
      compact: "p-3",
      none: "p-0",
    },
    // Hover and press are the neutral ink layer: the card never lifts.
    interactive: {
      true: ["m3-state-layer", "cursor-pointer", "[--state-layer-color:var(--m3-on-surface)]"],
      false: [],
    },
  },
  defaultVariants: {
    variant: "elevated",
    density: "default",
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
 * AdminCard — the cockpit's card, on the shared card surface (F7).
 *
 * - elevated and outlined: the card surface, the installed app's card: its fill,
 *   a 1px edge, a faint shadow and the 24px corner
 * - filled: a tinted card on the same corner, with no edge and no shadow
 *
 * The interactive prop adds the neutral ink state layer and cursor-pointer.
 */
export function AdminCard({
  className,
  variant,
  density,
  interactive = false,
  children,
  style,
  ...props
}: AdminCardProps) {
  // Controlled Chrome contract: route cards stay solid M3 surfaces. Workspace
  // tone belongs to the canvas, PageHeader hairline, active state, sheets, nav,
  // and FAB rather than a per-card tint layer.
  return (
    <div
      data-component="AdminCard"
      className={cn("relative", adminCardVariants({ variant, density, interactive }), className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

AdminCard.displayName = "AdminCard";

// ============================================================================
// Slots
// ============================================================================

/**
 * Sectioned-card slots for surfaces migrating off the legacy shared `Card`
 * (Header/Body/Footer). Use with `<AdminCard density="none">` so the slots
 * own the padding; hairlines ride the warm stroke step. Header rows default
 * to `items-center` — pass `items-start` when stacking with `flex-col`.
 */
export function AdminCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-component="AdminCardHeader"
      className={cn(
        "flex items-center justify-between gap-3 border-b border-stroke-soft px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

/** The shared 16px/600 heading tier for admin cards and their sections. */
export function AdminCardTitle({
  as: Tag = "h3",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "h2" | "h3" | "h4" | "p" }) {
  return (
    <Tag className={cn("type-title-md font-semibold text-text-strong", className)} {...props} />
  );
}

export function AdminCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-component="AdminCardBody" className={cn("p-4", className)} {...props} />;
}
