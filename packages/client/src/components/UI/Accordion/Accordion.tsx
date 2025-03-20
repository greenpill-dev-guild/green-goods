"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { RiAddLargeLine, RiAddLine, RiArrowDownBoxFill, RiQuestionLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { FlexCard } from "../Card/Card";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
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
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
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
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
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

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
