import { InputHTMLAttributes, forwardRef } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helperText, error, className, ...props }, ref) => (
    <div className={`${className} flex flex-col gap-1 mb-2`}>
      <label className="font-semibold text-slate-800" htmlFor={props.id}>
        {label}
      </label>
      <input
        className="input" //py-3 px-4 block w-full border-slate-200 bg-white rounded-lg shadow-sm text-sm focus:border-teal-500 focus:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none"
        {...props}
        ref={ref}
      />
      <p
        id={`${props.id}-input-helper-text`}
        className={`
          text-xs h-3
          ${error ? "text-red-600" : "text-slate-600"}
        `}
      >
        {helperText ?? error}
      </p>
    </div>
  )
);

FormInput.displayName = "FormInput";
