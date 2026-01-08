import { forwardRef, type InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helperText, error, className, ...props }, ref) => (
    <div className={`flex flex-col gap-1 ${className ?? ""} ${error ? "shake-error" : ""}`}>
      <label className="font-semibold text-text-strong-950 text-label-sm" htmlFor={props.id}>
        {label}
      </label>
      <input
        className={`input block w-full bg-inherit text-text-strong-950 placeholder:text-text-soft-400 border border-stroke-sub-300 rounded-lg py-3 px-4 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 ${
          error ? "border-error-base focus:ring-error-lighter" : "focus:input-focus-animation"
        }`}
        {...props}
        ref={ref}
      />
      {(helperText || error) && (
        <p
          id={`${props.id}-input-helper-text`}
          className={`
          text-xs h-3
          ${error ? "text-error-base" : "text-text-sub-600"}
        `}
        >
          {helperText ?? error}
        </p>
      )}
    </div>
  )
);

FormInput.displayName = "FormInput";
