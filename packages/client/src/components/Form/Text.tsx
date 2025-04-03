import { InputHTMLAttributes, forwardRef } from "react";

interface FormTextProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  rows: number;
  label: string;
  error?: string;
  className?: string;
  helperText?: string;
}

export const FormText = forwardRef<HTMLTextAreaElement, FormTextProps>(
  ({ rows, label, error, className, helperText, ...props }, ref) => {
    return (
      <div className={`${className} flex flex-col gap-1 mb-2`}>
        <label htmlFor={props.id} className="font-semibold text-slate-800">
          {label}
        </label>
        <textarea
          ref={ref}
          id={props.id}
          className="py-3 px-4 block w-full border-slate-200 bg-white  rounded-lg text-sm focus:border-teal-500 focus:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none"
          rows={rows}
          {...props}
        ></textarea>
        <p
          className={`
          text-xs h-3
          ${error ? "text-red-600" : "text-slate-600"}
        `}
          id={`${props.id}-helper-text`}
        >
          {helperText ?? error}
        </p>
      </div>
    );
  }
);

FormText.displayName = "FormText";
