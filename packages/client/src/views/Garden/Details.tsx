import type { WorkFormData } from "@green-goods/shared/hooks/work/useWorkForm";
import { normalizeTimeSpentMinutes } from "@green-goods/shared/utils/form/normalizers";
import { RiFileFill } from "@remixicon/react";
import type { Control, Path, UseFormRegister } from "react-hook-form";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { FormInput, FormSelect, FormText } from "@/components/Inputs";

interface WorkDetailsProps {
  config?: Action["details"];
  inputs: WorkInput[];
  register: UseFormRegister<WorkFormData>;
  control: Control<WorkFormData>;
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

      {/* Time Spent Input - Always shown as a default field */}
      <FormInput
        {...register("timeSpentMinutes", {
          setValueAs: normalizeTimeSpentMinutes,
        })}
        label={intl.formatMessage({
          id: "app.garden.details.timeSpent",
          defaultMessage: "Time Spent (hours)",
        })}
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        placeholder={intl.formatMessage({
          id: "app.garden.details.timeSpentPlaceholder",
          defaultMessage: "e.g., 1.5 for 1h 30m",
        })}
        helperText={intl.formatMessage({
          id: "app.garden.details.timeSpentHint",
          defaultMessage: "Enter hours spent on this work (decimals OK)",
        })}
      />

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

        // Cast key to Path for dynamic form fields
        const fieldKey = key as Path<WorkFormData>;

        if (type === "number") {
          return (
            <FormInput
              key={key}
              {...register(fieldKey, registerOptions)}
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
              name={fieldKey}
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
              {...register(fieldKey, registerOptions)}
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
              {...register(fieldKey, registerOptions)}
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
