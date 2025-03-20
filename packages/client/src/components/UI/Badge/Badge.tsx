import { cn } from "@/utils/cn"
import type * as React from "react"
import { tv, type VariantProps } from "tailwind-variants"

const badgeVariants = tv(
  {
    base: "inline-flex items-center rounded-md border px-.5 py-.25 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring  focus:ring-offset-2 text-nowrap whitespace-nowrap",
    variants: {
      variant: {
        transparent:
          "font-semibold border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        pill:
          "border-transparent rounded-2xl",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-card-darkergrey p-.5 px-1 text-xs",
      },
      tint: {
        green: "bg-green-100",
        red: "bg-red-100",
        black: "bg-black text-white",
        blue: "bg-blue-100",
        none: "bg-transparent",
      }
    },
    compoundVariants: [
      {
        variant: "transparent",
        class: "bg-transparent",
        tint: "none"
      }
    ],
    defaultVariants: {
      variant: "transparent",
      tint: "none",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, tint, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, tint }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
