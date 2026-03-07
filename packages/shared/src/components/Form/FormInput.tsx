import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";
import { controlInputVariants } from "../Tokens/foundation";
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
  ({ label, helperText, error, className, controlSize = "md", ...props }, ref) => {
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
            controlInputVariants({ size: controlSize, invalid: Boolean(error) }),
            className
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
