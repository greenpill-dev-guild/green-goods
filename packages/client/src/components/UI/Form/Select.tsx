// import "react-tailwindcss-select/dist/index.css";

import { forwardRef } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import Select from "react-select";

interface FormSelectProps<T extends FieldValues = FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  error?: string;
  options: { label: string; value: string }[] | undefined;
  control: Control<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormSelectComponent = forwardRef<HTMLSelectElement, FormSelectProps<any>>(
  ({ name, label, options, placeholder, control }, _ref) => {
    const normalizedOptions = Array.isArray(options) ? options : [];

    return (
      <Controller
        name={name}
        control={control}
        defaultValue={[]}
        render={({ field }) => (
          <div className="">
            <label htmlFor={name} className="font-semibold text-slate-800  text-label-sm">
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
