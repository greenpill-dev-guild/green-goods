import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
}

/**
 * Shared form textarea component with label, error, and helper text support.
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
      <label className="font-semibold text-slate-800 text-sm" htmlFor={props.id}>
        {label}
      </label>
      <textarea
        className={cn(
          "block w-full bg-white border border-slate-300 rounded-lg py-3 px-4",
          "text-sm transition-all duration-200 resize-none",
          "disabled:opacity-50 disabled:pointer-events-none",
          error
            ? "border-red-500 focus:ring-red-200 focus:ring-2 focus:border-red-500"
            : "focus:ring-green-200 focus:ring-2 focus:border-green-500"
        )}
        rows={rows}
        {...props}
        ref={ref}
      />
      {(helperText || error) && (
        <p
          id={`${props.id}-helper-text`}
          className={cn("text-xs min-h-[1rem]", error ? "text-red-600" : "text-slate-600")}
        >
          {error || helperText}
        </p>
      )}
    </div>
  )
);

FormTextarea.displayName = "FormTextarea";
