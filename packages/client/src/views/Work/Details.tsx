import { UseFormRegister } from "react-hook-form";

import { FormText } from "@/components/Form/Text";
import { FormInput } from "@/components/Form/Input";
// import { FormSelect } from "@/components/Form/Select";

interface WorkDetailsProps {
  title?: string;
  description: string;
  feedbackPlaceholder: string;
  inputs: WorkInput[];
  register: UseFormRegister<WorkDraft>;
}

export const WorkDetails: React.FC<WorkDetailsProps> = ({
  title,
  description,
  feedbackPlaceholder,
  register,
  inputs,
}) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {inputs.map(({ placeholder, required, title, type }, index) => {
        if (type === "number") {
          return (
            <FormInput
              // @ts-ignore
              {...register(title)}
              key={index}
              label={title}
              type="number"
              placeholder={placeholder}
              required={required}
            />
          );
        } else if (type === "select") {
          return (
            // <FormSelect
            //   key={index}
            //   // @ts-ignore
            //   {...register(title)}
            //   label={title}
            //   placeholder={placeholder}
            //   options={options.map((option) => ({
            //     label: option,
            //     value: option,
            //   }))}
            // />
            null
          );
        } else if (type === "text") {
          return (
            <FormInput
              key={index}
              // @ts-ignore
              {...register(title)}
              label={title}
              placeholder={placeholder}
              required={required}
            />
          );
        } else if (type === "textarea") {
          return (
            <FormText
              // @ts-ignore
              {...register(title)}
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
      })}
      <FormText
        {...register("feedback")}
        label="Feedback"
        rows={4}
        placeholder={feedbackPlaceholder}
      />
    </div>
  );
};
