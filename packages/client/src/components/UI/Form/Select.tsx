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

// Custom styles matching design system (FormInput/FormText)
const customStyles: StylesConfig = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "white",
    borderColor: state.isFocused ? "rgb(34 197 94)" : "rgb(203 213 225)", // border-stroke-sub-300
    borderRadius: "0.5rem", // rounded-lg
    borderWidth: "1px",
    padding: "0.375rem 0.5rem", // py-3 px-4 equivalent (adjusted for multi-select)
    minHeight: "3rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(34, 197, 94, 0.1)" : "none",
    transition: "all 150ms",
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover": {
        borderColor: state.isFocused ? "rgb(34 197 94)" : "rgb(148 163 184)",
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
    backgroundColor: "rgb(220 252 231)", // green-100
    borderRadius: "0.375rem", // rounded-md
    padding: "0.125rem 0.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    border: "1px solid rgb(187 247 208)", // green-200
    transition: "all 150ms",
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: "rgb(22 101 52)", // green-800
    fontSize: "0.875rem",
    fontWeight: "500",
    padding: "0.125rem 0.25rem",
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: "rgb(34 197 94)", // green-500
    cursor: "pointer",
    transition: "all 150ms",
    "&:hover": {
      backgroundColor: "rgb(187 247 208)", // green-200
      color: "rgb(22 101 52)", // green-800
    },
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "rgb(148 163 184)", // text-slate-400
    fontSize: "0.875rem",
  }),
  input: (provided) => ({
    ...provided,
    color: "rgb(30 41 59)", // text-slate-800
    fontSize: "0.875rem",
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: "0.5rem",
    marginTop: "0.25rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    border: "1px solid rgb(226 232 240)",
  }),
  menuList: (provided) => ({
    ...provided,
    padding: "0.25rem",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "rgb(220 252 231)" // green-100
      : state.isFocused
        ? "rgb(240 253 244)" // green-50
        : "white",
    color: state.isSelected ? "rgb(22 101 52)" : "rgb(30 41 59)", // green-800 : slate-800
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: state.isSelected ? "500" : "400",
    padding: "0.5rem 0.75rem",
    borderRadius: "0.375rem",
    transition: "all 150ms",
    "&:active": {
      backgroundColor: "rgb(220 252 231)", // green-100
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
            <label htmlFor={name} className="font-semibold text-slate-800 text-label-sm">
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
              <p className="text-xs h-3 text-red-600" id={`${name}-helper-text`}>
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
