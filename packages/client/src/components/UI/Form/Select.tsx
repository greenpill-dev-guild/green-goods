// import "react-tailwindcss-select/dist/index.css";

import { forwardRef } from "react";
import { type Control, Controller, type FieldValues, type FieldPath } from "react-hook-form";
import Select from "react-select";

interface FormSelectProps<T extends FieldValues = FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  error?: string;
  options: { label: string; value: string }[];
  control: Control<T>;
}

const FormSelectComponent = forwardRef<HTMLSelectElement, FormSelectProps<any>>(
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

FormSelectComponent.displayName = "FormSelect";

export const FormSelect = FormSelectComponent as <T extends FieldValues = FieldValues>(
  props: FormSelectProps<T> & { ref?: React.Ref<HTMLSelectElement> }
) => React.ReactElement;
