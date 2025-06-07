"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/utils/cn";
import { tv, type VariantProps } from "tailwind-variants";

export const avatarVariants = tv({
  base: "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
  variants: {
    variant: {
      primary: "",
    },
    mode: {
      "no-outline": "border-0 shadow-0",
      outline: "border-slate-200 border",
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

export type AvatarVariantProps = VariantProps<typeof avatarVariants>;

export type AvatarRootProps = React.HTMLAttributes<HTMLDivElement> &
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
  AvatarVariantProps & {
    asChild?: boolean;
  };

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarRootProps>(
  ({ className, variant, mode, shadow, ...props }, ref) => {
    const avatar = avatarVariants({ variant, mode, shadow, class: className });
    return <AvatarPrimitive.Root ref={ref} className={cn(avatar)} {...props} />;
  }
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
