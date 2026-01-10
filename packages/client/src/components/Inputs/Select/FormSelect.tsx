import { forwardRef } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import Select, { type StylesConfig } from "react-select";

interface FormSelectProps<T extends FieldValues = FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  error?: string;
  options: { label: string; value: string }[] | undefined;
  control: Control<T>;
}

// Custom styles matching design system - using CSS variables for dark mode support
const customStyles: StylesConfig = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "rgb(var(--bg-white-0))",
    borderColor: state.isFocused ? "rgb(var(--primary-base))" : "rgb(var(--stroke-soft-200))",
    borderRadius: "0.5rem",
    borderWidth: "1px",
    padding: "0.375rem 0.5rem",
    minHeight: "3rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--primary-base), 0.1)" : "none",
    transition: "all 150ms",
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover": {
        borderColor: state.isFocused ? "rgb(var(--primary-base))" : "rgb(var(--stroke-sub-300))",
      },
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: "0.125rem 0.25rem",
    gap: "0.375rem",
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
    fontSize: "0.875rem",
  }),
  input: (provided) => ({
    ...provided,
    color: "rgb(var(--text-strong-950))",
    fontSize: "0.875rem",
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: "rgb(var(--bg-white-0))",
    borderRadius: "0.5rem",
    marginTop: "0.25rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormSelectComponent = forwardRef<HTMLSelectElement, FormSelectProps<any>>(
  ({ name, label, options, placeholder, control, error }, _ref) => {
    const normalizedOptions = Array.isArray(options) ? options : [];

    return (
      <Controller
        name={name}
        control={control}
        defaultValue={[]}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor={name} className="font-semibold text-text-strong-950 text-label-sm">
              {label}
            </label>
            <Select
              id={name}
              placeholder={placeholder}
              value={
                Array.isArray(field.value)
                  ? field.value.map((v: string) => ({ label: v, value: v }))
                  : []
              }
              options={normalizedOptions}
              onChange={(val) => field.onChange(Array.isArray(val) ? val.map((v) => v.value) : [])}
              isMulti
              styles={customStyles}
              classNamePrefix="select"
            />
            {error && (
              <p className="text-xs h-3 text-error-base" id={`${name}-helper-text`}>
                {error}
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
