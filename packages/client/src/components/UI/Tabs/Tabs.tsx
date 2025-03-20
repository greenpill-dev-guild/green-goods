"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/utils/cn";
import { tv, type VariantProps } from "tailwind-variants";


const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex flex-row items-center justify-evenly rounded-md bg-greengoods-grey border border-slate-200 w-full overflow-clip",
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
      gardenTabs: "data-[state=active]:bg-greengoods-lightgreen bg-white p-4 text-black/70 data-[state=active]:text-black",
      multiTabs: "rounded-sm px-3 py-1.5 text-sm disabled:opacity-50 data-[state=active]:bg-slate-200 data-[state=active]:text-foreground data-[state=active]:shadow-sm m-2",
    },
  },
  defaultVariants: {
    variant: "gardenTabs",
  },
});

export type TriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof triggerVariants>;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TriggerProps
>(({ className, variant, ...props }, ref) => {
  const classes = triggerVariants({ variant, class: className });
  return (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      classes
    )}
    {...props}
  />
)});
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
