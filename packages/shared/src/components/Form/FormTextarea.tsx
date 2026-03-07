import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";
import { controlTextareaVariants } from "../Tokens/foundation";
import { FormFieldWrapper } from "./FormFieldWrapper";

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
  controlSize?: "sm" | "md" | "lg";
}

/**
 * Shared form textarea component with label, error, and helper text support.
 * Uses Green Goods design tokens for consistent theming across client and admin.
 *
 * @example
 * <FormTextarea
 *   label="Description"
 *   placeholder="Enter description"
 *   rows={4}
 *   error={errors.description?.message}
 *   {...register("description")}
 * />
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, helperText, error, className, rows = 4, controlSize = "md", ...props }, ref) => {
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
        <textarea
          className={cn(
            controlTextareaVariants({ size: controlSize, invalid: Boolean(error) }),
            "mobile-safe-input",
            "resize-none",
            className
          )}
          rows={rows}
          aria-describedby={ariaDescribedBy}
          aria-invalid={!!error || undefined}
          {...props}
          ref={ref}
        />
      </FormFieldWrapper>
    );
  }
);

FormTextarea.displayName = "FormTextarea";
