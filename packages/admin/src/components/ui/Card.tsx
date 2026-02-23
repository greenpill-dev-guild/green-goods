import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "./cn";

const cardVariants = tv({
  base: "rounded-xl border border-stroke-soft bg-bg-white shadow-sm",
  variants: {
    variant: {
      default: "",
      interactive: "cursor-pointer transition-shadow duration-200 hover:shadow-md",
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

type CardVariantProps = VariantProps<typeof cardVariants>;

interface CardRootProps extends React.HTMLAttributes<HTMLDivElement>, CardVariantProps {}

const CardRoot = React.forwardRef<HTMLDivElement, CardRootProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props} />
  )
);
CardRoot.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
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
CardHeader.displayName = "Card.Header";

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 sm:p-6", className)} {...props} />
  )
);
CardBody.displayName = "Card.Body";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
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
CardFooter.displayName = "Card.Footer";

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export { Card, cardVariants };
export type { CardRootProps as CardProps };
