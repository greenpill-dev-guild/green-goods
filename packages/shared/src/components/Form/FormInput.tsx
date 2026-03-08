import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";
import { FormFieldWrapper } from "./FormFieldWrapper";

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  controlSize?: "sm" | "md" | "lg";
}

/**
 * Shared form input component with label, error, and helper text support.
 * Uses Green Goods design tokens for consistent theming across client and admin.
 *
 * @example
 * <FormInput
 *   label="Email"
 *   placeholder="Enter your email"
 *   error={errors.email?.message}
 *   {...register("email")}
 * />
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helperText, error, className, ...props }, ref) => {
    const helperId = props.id ? `${props.id}-helper-text` : undefined;
    const ariaDescribedBy = (helperText || error) && helperId ? helperId : undefined;

    return (
      <FormFieldWrapper
        id={props.id}
        label={label}
        helperText={helperText}
        error={error}
        className={className}
      >
        <input
          className={cn(
            "block w-full bg-bg-white-0 border border-stroke-sub-300 rounded-lg py-3 px-4",
            "text-sm text-text-strong-950 placeholder:text-text-soft-400",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-error-base focus-visible:ring-2 focus-visible:ring-error-lighter focus-visible:border-error-base"
              : "focus-visible:ring-2 focus-visible:ring-primary-lighter focus-visible:border-primary-base"
          )}
          aria-describedby={ariaDescribedBy}
          aria-invalid={!!error || undefined}
          {...props}
          ref={ref}
        />
      </FormFieldWrapper>
    );
  }
);

FormInput.displayName = "FormInput";
