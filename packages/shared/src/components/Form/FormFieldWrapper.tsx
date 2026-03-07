import { type ReactNode } from "react";
import { cn } from "../../utils/styles/cn";
import { formErrorClassName, formHelperClassName, formLabelClassName } from "../Tokens/foundation";

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
    <div className={cn("flex flex-col gap-1.5", error && "shake-error", className)}>
      <label className={formLabelClassName} htmlFor={id}>
        {label}
      </label>
      {children}
      {(helperText || error) && (
        <p
          id={id ? `${id}-helper-text` : undefined}
          className={cn("min-h-[1rem]", error ? formErrorClassName : formHelperClassName)}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}
