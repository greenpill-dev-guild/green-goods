import { RiFileFill } from "@remixicon/react";
import { Control, UseFormRegister } from "react-hook-form";

import { FormInfo } from "@/components/Form/Info";
import { FormText } from "@/components/Form/Text";
import { FormInput } from "@/components/Form/Input";
import { FormSelect } from "@/components/Form/Select";

interface WorkDetailsProps {
  instruction: string;
  feedbackPlaceholder: string;
  inputs: WorkInput[];
  register: UseFormRegister<WorkDraft>;
  control: Control<WorkDraft>;
}

export const WorkDetails: React.FC<WorkDetailsProps> = ({
  instruction,
  feedbackPlaceholder,
  register,
  control,
  inputs,
}) => {
  return (
    <div>
      <FormInfo title="Enter Details" info={instruction} Icon={RiFileFill} />
      {inputs.map(
        ({ placeholder, options, required, title, key, type }, index) => {
          if (type === "number") {
            return (
              <FormInput
                // @ts-ignore
                {...register(key)}
                key={index}
                label={title}
                type="number"
                placeholder={placeholder}
                required={required}
              />
            );
          } else if (type === "select") {
            return (
              <FormSelect
                key={index}
                // @ts-ignore
                {...register(title)}
                label={title}
                placeholder={placeholder}
                selected={[]}
                onRemove={() => {}}
                options={options.map((option) => ({
                  label: option,
                  value: option,
                }))}
                control={control}
              />
            );
          } else if (type === "text") {
            return (
              <FormInput
                key={index}
                // @ts-ignore
                {...register(key)}
                label={title}
                placeholder={placeholder}
                required={required}
              />
            );
          } else if (type === "textarea") {
            return (
              <FormText
                // @ts-ignore
                {...register(key)}
                key={index}
                label={title}
                rows={3}
                placeholder={placeholder}
                required={required}
              />
            );
          } else {
            return null;
          }
        }
      )}
      <FormText
        {...register("feedback")}
        label="Feedback"
        rows={4}
        placeholder={feedbackPlaceholder}
      />
    </div>
  );
};
