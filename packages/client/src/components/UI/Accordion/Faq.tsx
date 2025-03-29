"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { RiAddLine, RiQuestionLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { FlexCard } from "../Card/Card";

const Faq = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
    <AccordionPrimitive.Root
      ref={ref}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
));
Faq.displayName = "Faq";

const FaqItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <FlexCard size="small">
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("flex flex-col grow w-full items-start justify-items-start gap-2", className)}
      {...props}
    />
  </FlexCard>
));
FaqItem.displayName = "FaqItem";

const FaqTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-row w-full gap-3 text-base font-medium transition-all [&[data-state=open]>svg:first-of-type]:text-primary [&[data-state=open]>svg:first-of-type]:scale-110 [&[data-state=open]>svg:first-of-type]:animate-spring-bump grow text-left items-start",
        className
      )}
      {...props}
    >
      <RiQuestionLine className="w-6 h-6 shrink-0 text-[#525865] transition-all " />
      <div className="flex grow">{children}</div>
      <RiAddLine className="h-5 w-5 shrink-0 transition-transform duration-200 text-[#9A9FAD] flex text-right " />
    </AccordionPrimitive.Trigger>
));
FaqTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const FaqContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down duration-1000"
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
));

FaqContent.displayName = AccordionPrimitive.Content.displayName;

export { Faq, FaqItem, FaqTrigger, FaqContent };