import { type ReactNode } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormFieldWrapperProps {
  id?: string;
  label: string;
  helperText?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Shared wrapper for form fields that renders label, error, and helper text.
 * Links error/helper text to the input via aria-describedby (using `${id}-helper-text`).
 *
 * Used internally by FormInput and FormTextarea to eliminate duplication.
 */
export function FormFieldWrapper({
  id,
  label,
  helperText,
  error,
  className,
  children,
}: FormFieldWrapperProps) {
  return (
    <div className={cn("flex flex-col gap-1", error && "shake-error", className)}>
      <label className="font-semibold text-text-strong-950 text-label-sm" htmlFor={id}>
        {label}
      </label>
      {children}
      {(helperText || error) && (
        <p
          id={id ? `${id}-helper-text` : undefined}
          className={cn("text-xs min-h-[1rem]", error ? "text-error-base" : "text-text-sub-600")}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}
