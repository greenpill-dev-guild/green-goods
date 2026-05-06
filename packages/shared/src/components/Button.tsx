import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../utils/styles/cn";

export const buttonVariants = tv({
  base: "gg-button",
  variants: {
    variant: {
      primary: "gg-button-primary gg-button-filled",
      secondary: "gg-button-secondary",
      ghost: "gg-button-ghost",
      danger: "gg-button-danger",
    },
    size: {
      sm: "gg-button-size-sm",
      md: "gg-button-size-md",
      lg: "gg-button-size-lg",
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
