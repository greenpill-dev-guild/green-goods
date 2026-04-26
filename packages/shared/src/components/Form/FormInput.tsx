import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";
import { FormFieldWrapper } from "./FormFieldWrapper";

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
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
            "block w-full bg-bg-white-0 rounded-sm py-3 px-4",
            "text-text-strong-950 placeholder:text-text-soft-400 text-body-lg",
            "shadow-[var(--edge-rest)]",
            "transition-shadow duration-[var(--spring-effects-fast-duration,150ms)]",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "shadow-[0_0_0_1px_rgb(var(--error-base))] focus-visible:shadow-[var(--edge-focus)]"
              : "focus-visible:shadow-[var(--edge-focus)]"
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
