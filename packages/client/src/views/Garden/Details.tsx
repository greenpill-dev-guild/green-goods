import { RiFileFill } from "@remixicon/react";
import type { Control, UseFormRegister } from "react-hook-form";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/UI/Form/Info";
import { FormInput } from "@/components/UI/Form/Input";
import { FormSelect } from "@/components/UI/Form/Select";
import { FormText } from "@/components/UI/Form/Text";

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
  const intl = useIntl();
  return (
    <div className="flex flex-col gap-4">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.details.title",
          description: "Enter Details",
        })}
        info={instruction}
        Icon={RiFileFill}
      />
      {inputs.map(({ placeholder, options, required, title, key, type }) => {
        if (type === "number") {
          return (
            <FormInput
              // @ts-ignore
              {...register(key)}
              key={key}
              label={title}
              type="number"
              placeholder={placeholder}
              required={required}
            />
          );
        }
        if (type === "select") {
          return (
            <FormSelect
              key={key}
              // @ts-ignore
              {...register(key)}
              label={title}
              placeholder={placeholder}
              options={options.map((option) => ({
                label: option,
                value: option,
              }))}
              control={control}
            />
          );
        }
        if (type === "text") {
          return (
            <FormInput
              key={key}
              // @ts-ignore
              {...register(key)}
              label={title}
              placeholder={placeholder}
              required={required}
            />
          );
        }
        if (type === "textarea") {
          return (
            <FormText
              // @ts-ignore
              {...register(key)}
              key={key}
              label={title}
              rows={3}
              placeholder={placeholder}
              required={required}
            />
          );
        }
        return null;
      })}
      <FormText
        {...register("feedback")}
        label={intl.formatMessage({
          id: "app.garden.details.feedback",
          description: "Feedback",
        })}
        rows={4}
        placeholder={feedbackPlaceholder}
      />
    </div>
  );
};
