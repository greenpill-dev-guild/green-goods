import { cn } from "@green-goods/shared";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

export const cardVariants = tv({
  base: [cardShellVariants(), "flex flex-col"],
  variants: {
    variant: {
      primary: "",
      avatar: "",
    },
    mode: {
      "no-outline": "border-transparent shadow-none",
      outline: "",
      filled: "bg-bg-weak-50 border-transparent shadow-none",
    },
    size: {
      large: "min-h-18 p-5 sm:p-6",
      small: "h-auto p-4",
    },
    shadow: {
      "no-shadow": "shadow-none",
      shadow: "shadow-regular-sm",
    },
    animating: {
      default:
        "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-in-out hover:border-stroke-sub-300 hover:shadow-regular-sm active:translate-y-px",
      none: "",
    },
  },
  defaultVariants: {
    variant: "primary",
    mode: "outline",
    size: "large",
    animating: "default",
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
    return <div ref={ref} className={cn(classes)} {...props} />;
  }
);
Card.displayName = "Card";

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
    <div ref={ref} className={cn(cardSectionVariants({ size: "md" }), className)} {...props} />
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

const FlexCard = React.forwardRef<HTMLDivElement, CardRootProps>(({ className, ...props }, ref) => (
  <Card ref={ref} className={cn("flex flex-row items-center gap-3 grow", className)} {...props} />
));

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, FlexCard };
