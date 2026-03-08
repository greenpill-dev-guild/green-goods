import { cn } from "@green-goods/shared";
import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-strong">
        {label}
        {required && <span className="ml-0.5 text-error-base">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-error-dark" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-text-soft">{hint}</p>}
    </div>
  );
}
