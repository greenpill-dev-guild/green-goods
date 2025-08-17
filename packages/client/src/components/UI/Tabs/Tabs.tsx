"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/utils/cn";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex flex-row items-center justify-evenly rounded-md bg-border border border-border w-full overflow-clip",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const triggerVariants = tv({
  base: "inline-flex items-center justify-center whitespace-nowrap ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none transition-all grow",
  variants: {
    variant: {
      gardenTabs:
        "data-[state=active]:bg-secondary bg-white px-3 py-2 text-gray-500 data-[state=active]:text-black",
      multiTabs:
        "rounded-sm px-3 py-1.5 text-sm disabled:opacity-50 data-[state=active]:bg-gray-200 data-[state=active]:text-foreground data-[state=active]:shadow-sm m-2",
    },
  },
  defaultVariants: {
    variant: "multiTabs",
  },
});

export type TriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof triggerVariants>;

function scrollContainerToTop() {
  const el = document.getElementById("app-scroll");
  if (el) {
    el.scrollTop = 0;
  } else if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TriggerProps>(
  ({ className, variant, onClick, ...props }, ref) => {
    const classes = triggerVariants({ variant, class: className });
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(classes)}
        onClick={(event) => {
          // Reset the main scroll container when switching tabs
          const target = event.currentTarget as HTMLElement;
          // Try nearest scrollable ancestor first; fall back to app container/window
          const findScrollableAncestor = (start: HTMLElement | null): HTMLElement | null => {
            let el: HTMLElement | null = start;
            while (el && el !== document.body) {
              const style = window.getComputedStyle(el);
              const overflowY = style.overflowY;
              if (
                (overflowY === "auto" || overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight
              ) {
                return el;
              }
              el = el.parentElement;
            }
            return null;
          };
          const nearest = findScrollableAncestor(target);
          if (nearest) {
            nearest.scrollTop = 0;
          } else {
            scrollContainerToTop();
          }
          if (onClick) onClick(event);
        }}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
