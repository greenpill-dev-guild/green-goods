import { forwardRef, type InputHTMLAttributes } from "react";

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
      <div className={`flex flex-col gap-1 ${className ?? ""} ${error ? "shake-error" : ""}`}>
        <label htmlFor={props.id} className="font-semibold text-text-strong-950  text-label-sm">
          {label}
        </label>
        <textarea
          ref={ref}
          id={props.id}
          className={`py-3 px-4 block w-full border-stroke-sub-300 bg-bg-white-0 text-text-strong-950 placeholder:text-text-soft-400 rounded-lg text-sm disabled:opacity-50 disabled:pointer-events-none border transition-all duration-200 ${
            error ? "border-error-base focus:ring-error-lighter" : "focus:input-focus-animation"
          }`}
          rows={rows}
          {...props}
        />
        <p
          className={`
          text-xs h-3
          ${error ? "text-error-base" : "text-text-sub-600"}
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
