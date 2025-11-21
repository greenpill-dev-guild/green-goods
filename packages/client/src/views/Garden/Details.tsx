import { RiFileFill } from "@remixicon/react";
import { useEffect } from "react";
import type { Control, UseFormRegister } from "react-hook-form";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/UI/Form/Info";
import { FormInput } from "@/components/UI/Form/Input";
import { FormSelect } from "@/components/UI/Form/Select";
import { FormText } from "@/components/UI/Form/Text";

interface WorkDetailsProps {
  config?: Action["details"];
  inputs: WorkInput[];
  register: UseFormRegister<{
    feedback: string;
    plantSelection: string[];
    plantCount?: number;
  }>;
  control: Control<{
    feedback: string;
    plantSelection: string[];
    plantCount?: number;
  }>;
}

export const WorkDetails: React.FC<WorkDetailsProps> = ({ config, register, control, inputs }) => {
  const intl = useIntl();
  const detailsTitle =
    config?.title ??
    intl.formatMessage({
      id: "app.garden.details.title",
      description: "Enter Details",
    });
  const detailsDescription =
    config?.description ??
    intl.formatMessage({
      id: "app.garden.submit.tab.details.instruction",
      defaultMessage: "Provide detailed information and feedback",
    });
  const feedbackPlaceholder =
    config?.feedbackPlaceholder ??
    intl.formatMessage({
      id: "app.garden.details.feedbackPlaceholder",
      defaultMessage: "Provide feedback or any observations",
    });

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={detailsTitle} info={detailsDescription} Icon={RiFileFill} />
      {inputs.map((input) => {
        if (!input) return null;

        const {
          placeholder = "",
          options = [],
          required = false,
          title = "",
          key,
          type,
        } = input as WorkInput & { options?: string[] };

        const selectOptions = Array.isArray(options) ? options : [];
        const registerOptions =
          type === "number"
            ? {
                setValueAs: (value: unknown) => {
                  if (value === "" || value === null || value === undefined) {
                    return undefined;
                  }
                  if (typeof value === "number") return value;
                  if (typeof value === "string") {
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  }
                  return undefined;
                },
              }
            : undefined;

        if (type === "number") {
          return (
            <FormInput
              key={key}
              // @ts-ignore
              {...register(key, registerOptions)}
              label={title}
              type="number"
              placeholder={placeholder}
              required={required}
              inputMode="numeric"
            />
          );
        }
        if (type === "select") {
          return (
            <FormSelect
              key={key}
              name={key}
              label={title}
              placeholder={placeholder}
              options={selectOptions.map((option) => ({
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
              {...register(key, registerOptions)}
              label={title}
              placeholder={placeholder}
              required={required}
            />
          );
        }
        if (type === "textarea") {
          return (
            <FormText
              key={key}
              // @ts-ignore
              {...register(key, registerOptions)}
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
