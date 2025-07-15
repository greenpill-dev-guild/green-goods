import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/utils/cn";

const badgeVariants = tv({
  base: "items-center rounded-md border px-.5 py-.25 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-nowrap whitespace-nowrap flex flex-row gap-1",
  variants: {
    variant: {
      transparent: "font-medium border-transparent bg-primary text-foreground hover:bg-primary/80",
      pill: "border-0 border-transparent rounded-2xl text-sm p-0.5 px-2 font-medium",
      outline: "text-foreground border-stroke-soft-200 p-1 px-1.5 text-xs",
    },
    tint: {
      primary: "bg-primary text-primary-foreground",
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

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & {
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
  };

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

export { Badge, badgeVariants };
