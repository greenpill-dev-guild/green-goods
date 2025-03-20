import { cn } from "@/utils/cn"
import type * as React from "react"
import { tv, type VariantProps } from "tailwind-variants"

const badgeVariants = tv(
  {
    base: "inline-flex items-center rounded-md border px-.5 py-.25 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    variants: {
      variant: {
        transparent:
          "font-semibold border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        pill:
          "border-transparent rounded-2xl",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
      tint: {
        green: "bg-green-100",
        red: "bg-red-100",
        black: "bg-black text-white",
        blue: "bg-blue-100",
      }
    },
    compoundVariants: [
      {
        variant: "transparent",
        class: "bg-transparent"
      }
    ],
    defaultVariants: {
      variant: "transparent",
      tint: "green",
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
