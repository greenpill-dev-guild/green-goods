import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { RiCheckLine, RiAlertLine, RiCloseLine, RiInformationLine } from "@remixicon/react";

import { cn } from "./cn";

const defaultIcons: Record<string, React.ReactNode> = {
  success: <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />,
  warning: <RiAlertLine className="h-3.5 w-3.5" aria-hidden="true" />,
  error: <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />,
  info: <RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />,
};

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

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, StatusBadgeVariantProps {
  /** Custom icon element. When omitted, a default icon matching the variant is shown. */
  icon?: React.ReactNode;
  /** Whether to show the icon (default: true). Set false for compact inline usage. */
  showIcon?: boolean;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, icon, showIcon = true, ...props }, ref) => {
    const resolvedIcon = icon ?? (variant ? defaultIcons[variant] : undefined);

    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {showIcon && resolvedIcon}
        {props.children}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
export type { StatusBadgeProps };
