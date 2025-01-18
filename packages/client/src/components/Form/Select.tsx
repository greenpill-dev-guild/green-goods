// import "react-tailwindcss-select/dist/index.css";

import Select from "react-select";
import { forwardRef } from "react";
import { RiCloseFill } from "@remixicon/react";
import { Control, Controller } from "react-hook-form";

interface FormSelectProps {
  label: string;
  placeholder: string;
  selected: string[];
  onRemove: (value: string) => void;
  error?: string;
  helperText?: string;
  options: { label: string; value: string }[];
  control: Control<any>;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      label,
      selected,
      onRemove,
      // error,
      // helperText,
      options,
      control,
      // ...props
    },
    _ref
  ) => {
    return (
      <Controller
        name="select"
        control={control}
        render={(field) => (
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">
              <h3 className="text-lg font-bold text-slate-600">{label}</h3>
            </label>
            {selected.length > 0 &&
              selected.map((id) => (
                <div
                  key={id}
                  className="border border-slate-400 rounded leading-8 text-xs px-2 font-bold inline-block mb-3"
                >
                  <input type="hidden" value={id} />
                  <div className="flex">
                    {options.find((option) => option.value === id)?.label}
                    <RiCloseFill
                      onClick={() => onRemove(id)}
                      className="h-3 ml-2 mt-2.5 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            <Select
              {...field}
              options={options}
              isMulti
              // className={`basic-multi-select ${errors.plants ? "border-red-500" : ""}`}
              classNamePrefix="select"
            />
          </div>
        )}
      />
    );
  }
);

FormSelect.displayName = "FormSelect";
