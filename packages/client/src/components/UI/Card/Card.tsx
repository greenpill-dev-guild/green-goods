import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

export const cardVariants = tv({
  base: "rounded-2xl border bg-card text-card-foreground flex gap-0.5 justify-between border-slate-200 p-1 px-4 min-h-18",
  variants: {
    variant: {
      primary: "",
      avatar: "",
    },
    mode: {
      "no-outline": "border-0 shadow-0",
      outline: "border-slate-200 border",
      filled: "bg-card-grey border-0"
    },
    size: {
      large: "",
      small: "",
    },
    shadow: {
      "no-shadow": "shadow-none",
      shadow: "shadow-md"
    }
  },
  defaultVariants: {
    variant: "primary",
    mode: "outline",
    size: "large",
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

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
