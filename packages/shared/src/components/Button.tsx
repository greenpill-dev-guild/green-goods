import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../utils/styles/cn";

export const buttonVariants = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium",
    "transition-all duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))] focus-visible:ring-offset-2",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    variant: {
      primary:
        "bg-[rgb(var(--ws-primary,var(--primary-base)))] text-[rgb(var(--ws-on-primary,var(--primary-foreground)))] hover:brightness-90",
      secondary:
        "border border-stroke-soft bg-bg-white text-text-strong hover:border-stroke-sub hover:bg-bg-soft",
      ghost: "text-text-sub hover:bg-bg-soft hover:text-text-strong",
      danger: "bg-error-base text-destructive-foreground hover:bg-error-dark",
    },
    size: {
      sm: "h-8 px-3 text-label-sm",
      md: "h-10 px-4 text-label-lg",
      lg: "h-12 px-6 text-body-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  asChild?: boolean;
  loading?: boolean;
}

type SlottableChildProps = {
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  [key: string]: unknown;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const content = loading ? (
      <>
        <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
        {children}
      </>
    ) : (
      children
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<SlottableChildProps>;
      const childProps = child.props;

      return React.cloneElement(child, {
        ...(props as SlottableChildProps),
        ref,
        className: cn(buttonVariants({ variant, size }), childProps.className, className),
        "aria-busy": loading || undefined,
        children: loading ? (
          <>
            <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
            {childProps.children}
          </>
        ) : (
          childProps.children
        ),
      });
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = "Button";
