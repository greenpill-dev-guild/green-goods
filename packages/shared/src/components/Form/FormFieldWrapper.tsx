import { type ReactNode } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormFieldWrapperProps {
  id?: string;
  label: ReactNode;
  required?: boolean;
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
  required = false,
  helperText,
  error,
  className,
  children,
}: FormFieldWrapperProps) {
  return (
    <div className={cn("flex flex-col gap-1", error && "shake-error", className)}>
      <label className="font-medium text-text-strong-950 text-label-lg" htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-error-base">*</span>}
      </label>
      {children}
      <p
        id={id ? `${id}-helper-text` : undefined}
        role={error ? "alert" : undefined}
        tabIndex={helperText || error ? 0 : undefined}
        // Reserve two lines so hints and errors appear without moving the form; a rare third
        // line grows the slot instead of scrolling inside it (DL-018).
        style={{
          minBlockSize: "2lh",
          flexShrink: 0,
          fontSize: "var(--type-body-sm)",
          letterSpacing: "var(--type-body-sm-ls)",
          lineHeight: "var(--type-body-sm-lh)",
          overflowWrap: "anywhere",
        }}
        className={cn("gg-field-feedback", error ? "text-error-dark" : "text-text-sub-600")}
      >
        {error || helperText}
      </p>
    </div>
  );
}

export interface FormFieldProps {
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
    <FormFieldWrapper
      id={htmlFor}
      label={label}
      required={required}
      helperText={hint}
      error={error}
      className={cn("space-y-1.5", className)}
    >
      {children}
    </FormFieldWrapper>
  );
}
