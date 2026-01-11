import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/styles/cn";

export interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  error?: string;
}

/**
 * Shared form checkbox component with label, description, and error support.
 * Uses Green Goods design tokens for consistent theming across client and admin.
 *
 * @example
 * <FormCheckbox
 *   label="Accept terms"
 *   description="I agree to the terms and conditions"
 *   error={errors.terms?.message}
 *   {...register("terms")}
 * />
 */
export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, description, error, className, ...props }, ref) => (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-all",
          props.checked
            ? "border-success-base bg-success-lighter"
            : "border-stroke-soft-200 bg-bg-white-0 hover:border-stroke-sub-300 hover:bg-bg-weak-50"
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          className={cn(
            "mt-0.5 h-4 w-4 rounded border-stroke-sub-300",
            "text-success-base focus:ring-2 focus:ring-success-light focus:ring-offset-0",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          {...props}
        />
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "text-sm font-medium",
              props.checked ? "text-success-dark" : "text-text-strong-950"
            )}
          >
            {label}
          </span>
          {description && <span className="text-xs text-text-sub-600">{description}</span>}
        </div>
      </label>
      {error && <p className="text-xs text-error-base">{error}</p>}
    </div>
  )
);

FormCheckbox.displayName = "FormCheckbox";

export interface CheckboxGroupOption {
  value: string | number;
  label: string;
  description?: string;
}

export interface CheckboxGroupProps {
  options: CheckboxGroupOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  label?: string;
  error?: string;
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
}

/**
 * Shared checkbox group component for selecting multiple options.
 * Uses Green Goods design tokens for consistent theming.
 *
 * @example
 * <CheckboxGroup
 *   label="Select capitals"
 *   options={[
 *     { value: 0, label: "Social" },
 *     { value: 1, label: "Material" },
 *   ]}
 *   value={selectedCapitals}
 *   onChange={setSelectedCapitals}
 *   columns={2}
 * />
 */
export const CheckboxGroup = ({
  options,
  value,
  onChange,
  label,
  error,
  columns = 2,
  disabled = false,
}: CheckboxGroupProps) => {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  const handleToggle = (optionValue: string | number) => {
    if (disabled) return;

    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="font-semibold text-text-strong-950 text-label-sm">{label}</span>}
      <div className={cn("grid gap-2", gridCols[columns])}>
        {options.map((option) => {
          const isChecked = value.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all",
                isChecked
                  ? "border-success-base bg-success-lighter text-success-dark"
                  : "border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 hover:border-success-light hover:bg-success-lighter/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(option.value)}
                disabled={disabled}
                className={cn(
                  "h-4 w-4 rounded border-stroke-sub-300",
                  "text-success-base focus:ring-2 focus:ring-success-light focus:ring-offset-0"
                )}
              />
              <span className="flex-1 truncate font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs text-error-base">{error}</p>}
    </div>
  );
};
