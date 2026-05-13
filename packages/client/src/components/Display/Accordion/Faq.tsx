"use client";

import { cn } from "@green-goods/shared";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { RiAddLine, RiQuestionLine } from "@remixicon/react";
import * as React from "react";

type FaqProps = Omit<AccordionPrimitive.AccordionSingleProps, "type"> & {
  className?: string;
};

const Faq = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Root>, FaqProps>(
  ({ className, collapsible = true, ...props }, ref) => (
    <AccordionPrimitive.Root
      ref={ref}
      type="single"
      collapsible={collapsible}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
);
Faq.displayName = "Faq";

const FaqItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "flex h-auto w-full flex-col items-start justify-items-start gap-2 rounded-2xl border border-border bg-bg-white-0 px-4 py-4",
      className
    )}
    {...props}
  />
));
FaqItem.displayName = "FaqItem";

const FaqTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full grow flex-row items-start gap-3 text-left text-base font-medium transition-all duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] [&[data-state=open]>.faq-title]:text-primary [&[data-state=open]>.faq-toggle]:rotate-45 [&[data-state=open]>svg:first-of-type]:scale-110 [&[data-state=open]>svg:first-of-type]:animate-spring-bump [&[data-state=open]>svg:first-of-type]:text-primary",
      className
    )}
    {...props}
  >
    <RiQuestionLine className="w-6 h-6 shrink-0 text-primary transition-all duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]" />
    <div className="flex grow faq-title transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]">
      {children}
    </div>
    <RiAddLine className="faq-toggle flex h-5 w-5 shrink-0 text-right text-text-soft-400 transition-transform duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]" />
  </AccordionPrimitive.Trigger>
));
FaqTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const FaqContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden pl-9 pr-2 text-sm leading-relaxed text-text-sub-600 transition-all duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
));

FaqContent.displayName = AccordionPrimitive.Content.displayName;

export { Faq, FaqItem, FaqTrigger, FaqContent };
