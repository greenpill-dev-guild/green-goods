import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../utils/styles/cn";

const badgeVariants = tv({
  base: "items-center rounded-md border px-.5 py-.25 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-nowrap whitespace-nowrap flex flex-row gap-1",
  variants: {
    variant: {
      transparent: "font-medium border-transparent bg-primary text-foreground",
      pill: "border-0 border-transparent rounded-2xl text-sm p-0.5 px-2 font-medium",
      outline: "text-foreground border-stroke-soft-200 p-1 px-1.5 text-xs",
    },
    tint: {
      // Text on a green fill uses the action pair; bright green with text fails contrast (DL-017).
      primary: "bg-primary-action text-primary-action-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      tertiary: "bg-tertiary text-tertiary-foreground",
      accent: "bg-accent text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      black: "bg-black text-white",
      muted: "bg-muted text-mute-foreground",
      none: "bg-transparent",
    },
  },
  compoundVariants: [
    {
      variant: "transparent",
      class: "bg-transparent",
      tint: "none",
    },
  ],
  defaultVariants: {
    variant: "transparent",
    tint: "none",
  },
});

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, BadgeVariantProps {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  tint,
  children,
  leadingIcon,
  trailingIcon,
  ...props
}: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, tint }), className)} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </div>
  );
}

export interface CountBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** How many; nothing renders below one. */
  count: number;
  /** The largest number shown in full; above it the badge reads "{max}+". */
  max?: number;
  /**
   * Draws a 2px ring of the surface behind the badge, for a badge that sits on
   * an icon or a control's edge rather than beside a label.
   */
  ring?: boolean;
}

/**
 * CountBadge — the one count badge (F10): a 16px capsule, 11px numerals at
 * weight 600 on the action pair, the workspace tone's accent in the cockpit.
 * Styles live in shared `theme.css` as `.gg-count-badge`. Say what the number
 * counts in the owner's accessible name; the badge carries the digits only.
 */
function CountBadge({ count, max = 99, ring = false, className, ...props }: CountBadgeProps) {
  if (count < 1) return null;
  return (
    <span className={cn("gg-count-badge", className)} data-ring={ring || undefined} {...props}>
      {count > max ? `${max}+` : count}
    </span>
  );
}

export { Badge, badgeVariants, CountBadge };
