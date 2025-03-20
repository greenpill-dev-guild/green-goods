import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

export const cardVariants = tv({
  base: "rounded-2xl border flex gap-0.5 justify-between border-card p-1 px-4 bg-white",
  variants: {
    variant: {
      primary: "",
      avatar: "",
    },
    mode: {
      "no-outline": "border-0 shadow-0",
      outline: "border-card border shadow-xs",
      filled: "bg-card border-0"
    },
    size: {
      large: "min-h-18",
      small: "h-auto py-4",
    },
    shadow: {
      "no-shadow": "shadow-none",
      shadow: "shadow-md"
    },
    animating: {
      default: "active:brightness-107 active:bg-primary/5 transition-all duration-200 ease-in-out",
      none: ""
    }
  },
  defaultVariants: {
    variant: "primary",
    mode: "outline",
    size: "large",
    animating: "default"
  },
});

export type CardVariantProps = VariantProps<typeof cardVariants>;

export type CardRootProps = React.HTMLAttributes<HTMLDivElement> &
  CardVariantProps & {
    asChild?: boolean;
  };

const Card = React.forwardRef<HTMLDivElement, CardRootProps>(
  ({ className, variant, mode, size, ...props }, ref) => {
    const classes = cardVariants({ variant, mode, size, class: className });
    return (
      <div
        ref={ref}
        className={cn(
          classes
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

const FlexCard = React.forwardRef<HTMLDivElement, CardRootProps>(
  ({ className, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn("flex flex-row items-center gap-3 grow", className)}
      {...props}
    />
  )
);

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  FlexCard
};
