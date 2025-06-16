// import "react-tailwindcss-select/dist/index.css";

import { forwardRef } from "react";
import { type Control, Controller, type FieldValues } from "react-hook-form";
import Select from "react-select";

interface FormSelectProps {
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  options: { label: string; value: string }[];
  control: Control<FieldValues>;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ name, label, options, control }, _ref) => {
    return (
      <Controller
        name={name}
        control={control}
        render={(field) => (
          <div className="">
            <label htmlFor={name} className="font-semibold text-slate-800  text-label-sm">
              {label}
            </label>
            <Select
              id={name}
              value={field.field.value.map((v: string) => ({
                label: v,
                value: v,
              }))}
              options={options}
              onChange={(val) => field.field.onChange(val.map((v) => v.value))}
              isMulti
              classNamePrefix="select"
            />
          </div>
        )}
      />
    );
  }
);

FormSelect.displayName = "FormSelect";
