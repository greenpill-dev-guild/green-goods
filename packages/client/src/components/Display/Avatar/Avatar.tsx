"use client";

import { cn } from "@green-goods/shared/utils/styles/cn";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

const avatarVariants = tv({
  base: "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full",
  variants: {
    variant: {
      primary: "",
    },
    mode: {
      "no-outline": "border-0 shadow-0",
      outline: "border-stroke-soft-200 border",
    },
    shadow: {
      "no-shadow": "shadow-none",
      shadow: "shadow-sm",
    },
  },
  defaultVariants: {
    variant: "primary",
    mode: "outline",
    shadow: "no-shadow",
  },
});

type AvatarProps = React.HTMLAttributes<HTMLDivElement> &
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    asChild?: boolean;
  };

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, variant, mode, shadow, ...props }, ref) => {
    const avatar = avatarVariants({ variant, mode, shadow, class: className });
    return <AvatarPrimitive.Root ref={ref} className={cn(avatar)} {...props} />;
  }
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

export { Avatar };
