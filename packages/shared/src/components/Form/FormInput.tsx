import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

/**
 * Shared form input component with label, error, and helper text support.
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
  ({ label, helperText, error, className, ...props }, ref) => (
    <div className={cn("flex flex-col gap-1", error && "shake-error", className)}>
      <label className="font-semibold text-slate-800 text-sm" htmlFor={props.id}>
        {label}
      </label>
      <input
        className={cn(
          "block w-full bg-inherit border border-slate-300 rounded-lg py-3 px-4",
          "text-sm transition-all duration-200",
          "disabled:opacity-50 disabled:pointer-events-none",
          error
            ? "border-red-500 focus:ring-red-200 focus:ring-2 focus:border-red-500"
            : "focus:ring-green-200 focus:ring-2 focus:border-green-500"
        )}
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

FormInput.displayName = "FormInput";
