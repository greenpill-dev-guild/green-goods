import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../utils/styles/cn";

export const cardVariants = tv({
  base: "rounded-2xl border flex gap-0.5 justify-between border-border bg-bg-white-0",
  variants: {
    variant: {
      default: "",
      primary: "",
      elevated: "shadow-md",
    },
    mode: {
      outline: "border-border border shadow-xs",
      filled: "bg-card border-0",
      ghost: "border-0 shadow-none bg-transparent",
      "no-outline": "border-0 shadow-0",
    },
    size: {
      sm: "p-2",
      md: "p-4",
      lg: "p-6",
      auto: "",
    },
    interactive: {
      true: "cursor-pointer transition-all duration-200 active:brightness-102 active:bg-primary/1.5",
      false: "",
    },
    container: {
      true: "@container",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    mode: "outline",
    size: "auto",
    interactive: false,
    container: false,
  },
});

export type CardVariantProps = VariantProps<typeof cardVariants>;

export interface CardBaseProps extends React.HTMLAttributes<HTMLDivElement>, CardVariantProps {
  asChild?: boolean;
}

const CardBase = React.forwardRef<HTMLDivElement, CardBaseProps>(
  ({ className, variant, mode, size, interactive, container, ...props }, ref) => {
    const classes = cardVariants({ variant, mode, size, interactive, container });
    return <div ref={ref} className={cn(classes, className)} {...props} />;
  }
);
CardBase.displayName = "CardBase";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex-1", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

const surfaceCardVariants = tv({
  base: "rounded-lg glass-raised",
  variants: {
    variant: {
      default: "",
      interactive: [
        "cursor-pointer",
        "transition-[box-shadow,transform] duration-[var(--spring-spatial-fast-duration,200ms)] ease-[var(--spring-spatial-fast-easing)]",
        "hover:shadow-[var(--edge-hover),_var(--elevation-2)] hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.992]",
      ].join(" "),
    },
    padding: {
      compact: "p-4",
      feature: "p-6",
      none: "",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "none",
  },
});

export type SurfaceCardVariantProps = VariantProps<typeof surfaceCardVariants>;

type ColorAccent = "primary" | "success" | "warning" | "error" | "info";

const colorAccentMap: Record<ColorAccent, string> = {
  primary: "border-l-2 border-l-primary-base",
  success: "border-l-2 border-l-success-base",
  warning: "border-l-2 border-l-warning-base",
  error: "border-l-2 border-l-error-base",
  info: "border-l-2 border-l-information-base",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, SurfaceCardVariantProps {
  colorAccent?: ColorAccent;
}

const SurfaceCardRoot = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, colorAccent, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        surfaceCardVariants({ variant, padding }),
        colorAccent && colorAccentMap[colorAccent],
        className
      )}
      {...props}
    />
  )
);
SurfaceCardRoot.displayName = "Card";

const SurfaceCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b border-stroke-soft px-4 py-3 sm:px-6 sm:py-4",
        className
      )}
      {...props}
    />
  )
);
SurfaceCardHeader.displayName = "Card.Header";

const SurfaceCardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 sm:p-6", className)} {...props} />
  )
);
SurfaceCardBody.displayName = "Card.Body";

const SurfaceCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center border-t border-stroke-soft px-4 py-3 sm:px-6 sm:py-4",
        className
      )}
      {...props}
    />
  )
);
SurfaceCardFooter.displayName = "Card.Footer";

const Card = Object.assign(SurfaceCardRoot, {
  Header: SurfaceCardHeader,
  Body: SurfaceCardBody,
  Footer: SurfaceCardFooter,
});

export { CardBase, Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export { SurfaceCardBody as CardBody, surfaceCardVariants };
