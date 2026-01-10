import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
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
  ({ label, helperText, error, className, rows = 4, ...props }, ref) => (
    <div className={cn("flex flex-col gap-1", error && "shake-error", className)}>
      <label className="font-semibold text-text-strong-950 text-label-sm" htmlFor={props.id}>
        {label}
      </label>
      <textarea
        className={cn(
          "block w-full bg-bg-white-0 border border-stroke-sub-300 rounded-lg py-3 px-4",
          "text-sm text-text-strong-950 placeholder:text-text-soft-400",
          "transition-all duration-200 resize-none",
          "disabled:opacity-50 disabled:pointer-events-none",
          error
            ? "border-error-base focus:ring-2 focus:ring-error-lighter focus:border-error-base"
            : "focus:ring-2 focus:ring-primary-lighter focus:border-primary-base"
        )}
        rows={rows}
        {...props}
        ref={ref}
      />
      {(helperText || error) && (
        <p
          id={`${props.id}-helper-text`}
          className={cn("text-xs min-h-[1rem]", error ? "text-error-base" : "text-text-sub-600")}
        >
          {error || helperText}
        </p>
      )}
    </div>
  )
);

FormTextarea.displayName = "FormTextarea";
