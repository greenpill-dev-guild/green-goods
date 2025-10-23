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
      <div className={`flex flex-col gap-1 ${className ?? ""}`}>
        <label htmlFor={props.id} className="font-semibold text-slate-800  text-label-sm">
          {label}
        </label>
        <textarea
          ref={ref}
          id={props.id}
          className="py-3 px-4 block w-full border-stroke-sub-300 bg-white rounded-lg text-sm disabled:opacity-50 disabled:pointer-events-none border"
          rows={rows}
          {...props}
        />
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
