import { cn } from "@green-goods/shared";
import { Slot } from "@radix-ui/react-slot";
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

const buttonVariants = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    variant: {
      primary: "bg-primary-base text-primary-foreground hover:bg-primary-darker",
      secondary:
        "border border-stroke-soft bg-bg-white text-text-strong hover:bg-bg-soft hover:border-stroke-sub",
      ghost: "text-text-sub hover:bg-bg-soft hover:text-text-strong",
      danger: "bg-error-base text-destructive-foreground hover:bg-error-dark",
    },
    size: {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Component>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
