import { cn } from "../../utils/cn";
import type { ReactNode } from "react";

export interface FormLayoutProps {
  children: ReactNode;
  className?: string;
  /** Maximum width variant */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
};

/**
 * Shared layout wrapper for forms.
 * Provides consistent max-width, padding, and spacing.
 * Responsive: reduced padding on mobile.
 *
 * @example
 * <FormLayout maxWidth="lg">
 *   <FormInput ... />
 *   <FormTextarea ... />
 * </FormLayout>
 */
export function FormLayout({ children, className, maxWidth = "4xl" }: FormLayoutProps) {
  return (
    <div className={cn("mx-auto px-4 py-6 sm:px-6 sm:py-8", maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}
