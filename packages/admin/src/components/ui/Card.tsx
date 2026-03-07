import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cardSectionVariants, cardShellVariants, cn } from "@green-goods/shared";

const cardVariants = tv({
  base: [cardShellVariants(), "flex flex-col"],
  variants: {
    variant: {
      default: "",
      interactive: cardShellVariants({ interactive: true }),
    },
    padding: {
      compact: "p-4",
      feature: "p-5 sm:p-6",
      none: "",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "none",
  },
});

type CardVariantProps = VariantProps<typeof cardVariants>;

type ColorAccent = "primary" | "success" | "warning" | "error" | "info";

const colorAccentMap: Record<ColorAccent, string> = {
  primary: "border-l-2 border-l-primary-base",
  success: "border-l-2 border-l-success-base",
  warning: "border-l-2 border-l-warning-base",
  error: "border-l-2 border-l-error-base",
  info: "border-l-2 border-l-information-base",
};

interface CardRootProps extends React.HTMLAttributes<HTMLDivElement>, CardVariantProps {
  colorAccent?: ColorAccent;
}

const CardRoot = React.forwardRef<HTMLDivElement, CardRootProps>(
  ({ className, variant, padding, colorAccent, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, padding }),
        colorAccent && colorAccentMap[colorAccent],
        "overflow-hidden",
        className
      )}
      {...props}
    />
  )
);
CardRoot.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardSectionVariants({ size: "md", divider: "bottom" }),
        "flex items-center justify-between gap-4",
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = "Card.Header";

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(cardSectionVariants({ size: "md" }), className)} {...props} />
  )
);
CardBody.displayName = "Card.Body";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardSectionVariants({ size: "md", divider: "top" }),
        "flex items-center gap-3",
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
