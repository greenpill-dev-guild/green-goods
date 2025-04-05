import { InputHTMLAttributes, forwardRef } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helperText, error, className, ...props }, ref) => (
    <div className={`${className} flex flex-col gap-1`}>
      <label
        className="font-semibold text-slate-800 text-label-sm"
        htmlFor={props.id}
      >
        {label}
      </label>
      <input
        className="input bg-inherit border border-stroke-sub-300 rounded-lg py-3 px-4 disabled:opacity-50 disabled:pointer-events-none"
        {...props}
        ref={ref}
      />
      {(helperText || error) && (
        <p
          id={`${props.id}-input-helper-text`}
          className={`
          text-xs h-3
          ${error ? "text-red-600" : "text-slate-600"}
        `}
        >
          {helperText ?? error}
        </p>
      )}
    </div>
  )
);

FormInput.displayName = "FormInput";
