import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../utils/styles/cn";
import {
  cardDescriptionClassName,
  cardSectionVariants,
  cardShellVariants,
  cardTitleClassName,
} from "../Tokens/foundation";

export const cardVariants = tv({
  base: [cardShellVariants(), "flex flex-col"],
  variants: {
    variant: {
      default: "",
      primary: "",
      elevated: "shadow-regular-sm",
    },
    mode: {
      outline: "",
      filled: "bg-bg-weak-50 border-transparent shadow-none",
      ghost: "border-transparent shadow-none bg-transparent",
      "no-outline": "border-transparent shadow-none",
    },
    size: {
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-7",
      auto: "",
    },
    interactive: {
      true: cardShellVariants({ interactive: true }),
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
    <div
      ref={ref}
      className={cn(cardSectionVariants({ size: "md" }), "gap-1.5", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(cardTitleClassName, className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(cardDescriptionClassName, className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardSectionVariants({ size: "md" }), "flex-1", className)}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

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
CardFooter.displayName = "CardFooter";

export { CardBase, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
