import { forwardRef } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import Select, { type StylesConfig } from "react-select";
import {
  controlStyleSizes,
  formErrorClassName,
  formHelperClassName,
  formLabelClassName,
} from "../../Tokens/foundation";

export interface FormSelectOption {
  label: string;
  value: string;
}

export interface FormSelectProps<T extends FieldValues = FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  error?: string;
  options: FormSelectOption[] | undefined;
  control: Control<T>;
  isMulti?: boolean;
  controlSize?: "sm" | "md" | "lg";
  helperText?: string;
}

/**
 * Custom styles for react-select using CSS variables for dark mode support.
 * These styles match the Green Goods design system.
 */
const getCustomStyles = (
  size: "sm" | "md" | "lg",
  invalid: boolean
): StylesConfig<FormSelectOption, boolean> => {
  const controlSize = controlStyleSizes[size];

  return {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: "rgb(var(--bg-white-0))",
      borderColor: invalid
        ? "rgb(var(--error-base))"
        : state.isFocused
          ? "rgb(var(--primary-base))"
          : "rgb(var(--stroke-sub-300))",
      borderRadius: `${controlSize.borderRadius}px`,
      borderWidth: "1px",
      minHeight: `${controlSize.minHeight}px`,
      boxShadow: state.isFocused
        ? invalid
          ? "0 0 0 3px rgba(var(--error-base), 0.12)"
          : "0 0 0 3px rgba(var(--primary-base), 0.12)"
        : "none",
      transition: "all 150ms",
      "&:hover": {
        borderColor: invalid
          ? "rgb(var(--error-base))"
          : state.isFocused
            ? "rgb(var(--primary-base))"
            : "rgb(var(--stroke-sub-300))",
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: `0 ${Math.max(controlSize.paddingX - 4, 8)}px`,
      gap: `${controlSize.gap}px`,
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "rgb(var(--success-lighter))",
      borderRadius: "0.375rem",
      padding: "0.125rem 0.25rem",
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      border: "1px solid rgb(var(--success-light))",
      transition: "all 150ms",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: "rgb(var(--success-dark))",
      fontSize: "0.875rem",
      fontWeight: "500",
      padding: "0.125rem 0.25rem",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "rgb(var(--success-base))",
      cursor: "pointer",
      transition: "all 150ms",
      "&:hover": {
        backgroundColor: "rgb(var(--success-light))",
        color: "rgb(var(--success-dark))",
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "rgb(var(--text-soft-400))",
      fontSize: "1rem",
    }),
    input: (provided) => ({
      ...provided,
      color: "rgb(var(--text-strong-950))",
      fontSize: "1rem",
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: "rgb(var(--bg-white-0))",
      borderRadius: `${controlSize.borderRadius}px`,
      marginTop: "0.25rem",
      boxShadow: "var(--shadow-regular-sm)",
      border: "1px solid rgb(var(--stroke-soft-200))",
    }),
    menuList: (provided) => ({
      ...provided,
      padding: "0.25rem",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "rgb(var(--success-lighter))"
        : state.isFocused
          ? "rgb(var(--bg-weak-50))"
          : "rgb(var(--bg-white-0))",
      color: state.isSelected ? "rgb(var(--success-dark))" : "rgb(var(--text-strong-950))",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: state.isSelected ? "500" : "400",
      padding: "0.5rem 0.75rem",
      borderRadius: "0.375rem",
      transition: "all 150ms",
      "&:active": {
        backgroundColor: "rgb(var(--success-lighter))",
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "rgb(var(--text-strong-950))",
    }),
    indicatorSeparator: (provided) => ({
      ...provided,
      backgroundColor: "rgb(var(--stroke-soft-200))",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: "rgb(var(--text-soft-400))",
      "&:hover": {
        color: "rgb(var(--text-sub-600))",
      },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: "rgb(var(--text-soft-400))",
      "&:hover": {
        color: "rgb(var(--text-sub-600))",
      },
    }),
  };
};

/**
 * Shared form select component with react-select for multi-select support.
 * Uses Green Goods design tokens for consistent theming across client and admin.
 *
 * @example
 * <FormSelect
 *   name="tags"
 *   label="Tags"
 *   placeholder="Select tags..."
 *   options={[{ label: "Option 1", value: "1" }]}
 *   control={control}
 *   isMulti
 * />
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormSelectComponent = forwardRef<HTMLSelectElement, FormSelectProps<any>>(
  (
    {
      name,
      label,
      options,
      placeholder,
      control,
      error,
      helperText,
      isMulti = true,
      controlSize = "md",
    },
    _ref
  ) => {
    const normalizedOptions = Array.isArray(options) ? options : [];

    return (
      <Controller
        name={name}
        control={control}
        defaultValue={isMulti ? [] : ""}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={name} className={formLabelClassName}>
              {label}
            </label>
            <Select
              inputId={name}
              placeholder={placeholder}
              value={
                isMulti && Array.isArray(field.value)
                  ? field.value.map((v: string) => ({ label: v, value: v }))
                  : normalizedOptions.find((opt) => opt.value === field.value) || null
              }
              options={normalizedOptions}
              onChange={(val) => {
                if (isMulti) {
                  field.onChange(Array.isArray(val) ? val.map((v) => v.value) : []);
                } else {
                  field.onChange(val ? (val as FormSelectOption).value : "");
                }
              }}
              isMulti={isMulti}
              styles={getCustomStyles(controlSize, Boolean(error))}
              classNamePrefix="select"
            />
            {(helperText || error) && (
              <p
                className={error ? formErrorClassName : formHelperClassName}
                id={`${name}-helper-text`}
              >
                {error || helperText}
              </p>
            )}
          </div>
        )}
      />
    );
  }
);

FormSelectComponent.displayName = "FormSelect";

export const FormSelect = FormSelectComponent as <T extends FieldValues = FieldValues>(
  props: FormSelectProps<T> & { ref?: React.Ref<HTMLSelectElement> }
) => React.ReactElement;
