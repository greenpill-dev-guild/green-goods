import { forwardRef } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import Select, { type StylesConfig } from "react-select";
import { FormFieldWrapper } from "../FormFieldWrapper";

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
  required?: boolean;
}

/**
 * Custom styles for react-select using CSS variables for dark mode support.
 * These styles match the Green Goods design system.
 */
const customStyles: StylesConfig = {
  control: (provided, state) => {
    const invalid = state.selectProps["aria-invalid"] === true;
    const borderColor = invalid
      ? "rgb(var(--error-base))"
      : state.isFocused
        ? "rgb(var(--focus-ring))"
        : "rgb(var(--stroke-sub-300))";

    return {
      ...provided,
      backgroundColor: "rgb(var(--bg-white-0))",
      borderColor,
      borderRadius: "var(--radius-xl)",
      borderWidth: "1px",
      minHeight: "2.75rem",
      boxShadow: state.isFocused
        ? `0 0 0 3px rgb(var(${invalid ? "--error-base" : "--focus-ring"}) / 0.12)`
        : "none",
      transition:
        "border-color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing), box-shadow var(--spring-effects-fast-duration) var(--spring-effects-fast-easing)",
      "&:hover": { borderColor },
    };
  },
  valueContainer: (provided) => ({
    ...provided,
    padding: "0.5625rem 0.75rem",
    gap: "0.375rem",
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: "rgb(var(--success-lighter))",
    borderRadius: "var(--radius-md)",
    padding: "0.125rem 0.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    border: "1px solid rgb(var(--success-light))",
    transition:
      "background-color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing), border-color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing)",
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
    transition:
      "background-color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing), color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing)",
    "&:hover": {
      backgroundColor: "rgb(var(--success-light))",
      color: "rgb(var(--success-dark))",
    },
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "rgb(var(--text-soft-400))",
    fontSize: "var(--text-paragraph-md)",
    lineHeight: "var(--text-paragraph-md--line-height)",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  }),
  input: (provided) => ({
    ...provided,
    color: "rgb(var(--text-strong-950))",
    fontSize: "var(--text-paragraph-md)",
    lineHeight: "var(--text-paragraph-md--line-height)",
    margin: 0,
    padding: 0,
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: "rgb(var(--bg-white-0))",
    borderRadius: "var(--radius-lg)",
    marginTop: "0.25rem",
    boxShadow: "var(--shadow-regular-md)",
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
    fontSize: "var(--text-paragraph-md)",
    lineHeight: "var(--text-paragraph-md--line-height)",
    fontWeight: state.isSelected ? "500" : "400",
    padding: "0.5rem 0.75rem",
    borderRadius: "var(--radius-md)",
    transition:
      "background-color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing), color var(--spring-effects-fast-duration) var(--spring-effects-fast-easing)",
    "&:active": {
      backgroundColor: "rgb(var(--success-lighter))",
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "rgb(var(--text-strong-950))",
    fontSize: "var(--text-paragraph-md)",
    lineHeight: "var(--text-paragraph-md--line-height)",
    overflow: "visible",
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
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
  ({ name, label, options, placeholder, control, error, isMulti = true, required }, _ref) => {
    const normalizedOptions = Array.isArray(options) ? options : [];

    return (
      <Controller
        name={name}
        control={control}
        defaultValue={isMulti ? [] : ""}
        render={({ field }) => (
          <FormFieldWrapper id={name} label={label} required={required} error={error}>
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
              required={required}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={`${name}-helper-text`}
              styles={customStyles}
              classNamePrefix="select"
            />
          </FormFieldWrapper>
        )}
      />
    );
  }
);

FormSelectComponent.displayName = "FormSelect";

export const FormSelect = FormSelectComponent as <T extends FieldValues = FieldValues>(
  props: FormSelectProps<T> & { ref?: React.Ref<HTMLSelectElement> }
) => React.ReactElement;
