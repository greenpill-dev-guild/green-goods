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

export { CardBase, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
