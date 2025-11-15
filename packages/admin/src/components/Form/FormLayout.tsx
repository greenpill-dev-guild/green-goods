import type { ReactNode } from "react";

interface FormLayoutProps {
  children: ReactNode;
}

/**
 * Shared layout wrapper for multi-step creation forms
 * Provides consistent max-width, padding, and spacing
 * Responsive: reduced padding on mobile
 */
export function FormLayout({ children }: FormLayoutProps) {
  return <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}
