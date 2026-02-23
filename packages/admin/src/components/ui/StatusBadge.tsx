import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "./cn";

const statusBadgeVariants = tv({
  base: "inline-flex items-center gap-1 rounded-full font-medium",
  variants: {
    variant: {
      success: "bg-success-lighter text-success-dark",
      warning: "bg-warning-lighter text-warning-dark",
      error: "bg-error-lighter text-error-dark",
      info: "bg-information-lighter text-information-dark",
      neutral: "bg-bg-soft text-text-sub",
    },
    size: {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-1 text-sm",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "md",
  },
});

type StatusBadgeVariantProps = VariantProps<typeof statusBadgeVariants>;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, StatusBadgeVariantProps {}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(statusBadgeVariants({ variant, size }), className)} {...props} />
  )
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
export type { StatusBadgeProps };
