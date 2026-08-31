import type { useWorkForm } from "@green-goods/shared/hooks/work/useWorkForm";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";

export function SubmitWorkFields({
  inputs,
  control,
  register,
  errors,
}: {
  inputs: WorkInput[];
  control: ReturnType<typeof useWorkForm>["control"];
  register: ReturnType<typeof useWorkForm>["register"];
  errors: Record<string, { message?: string } | undefined>;
}) {
  const { formatMessage } = useIntl();
  if (inputs.length === 0) return null;

  return (
    <>
      {inputs.map((input) => {
        const error = errors[input.key]?.message;
        if (input.type === "number" || input.type === "text") {
          return (
            <AdminTextField
              key={input.key}
              label={input.title}
              id={input.key}
              type={input.type}
              required={input.required}
              error={error}
              placeholder={input.placeholder}
              inputProps={input.type === "number" ? { step: "any", min: 0 } : undefined}
              {...register(input.key, input.type === "number" ? { valueAsNumber: true } : {})}
            />
          );
        }
        if (input.type === "textarea") {
          return (
            <AdminTextArea
              key={input.key}
              label={input.title}
              id={input.key}
              rows={3}
              required={input.required}
              error={error}
              placeholder={input.placeholder}
              {...register(input.key)}
            />
          );
        }
        if (input.type === "select" || input.type === "band") {
          const options = input.type === "band" ? (input.bands ?? []) : (input.options ?? []);
          return (
            <AdminSelect
              key={input.key}
              label={input.title}
              id={input.key}
              required={input.required}
              error={error}
              {...register(input.key)}
            >
              <option value="">
                {input.placeholder ||
                  formatMessage({ id: "app.admin.work.submit.selectActionPlaceholder" })}
              </option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </AdminSelect>
          );
        }
        if (input.type !== "multi-select") return null;
        return (
          <Controller
            key={input.key}
            name={input.key}
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <AdminFieldGroup
                label={input.title}
                required={input.required}
                error={error}
                contentClassName="flex flex-wrap gap-2"
              >
                {(input.options ?? []).map((option) => {
                  const current = Array.isArray(field.value)
                    ? field.value.filter((value): value is string => typeof value === "string")
                    : [];
                  const selected = current.includes(option);
                  return (
                    <AdminFilterChip
                      key={option}
                      label={option}
                      selected={selected}
                      onToggle={() =>
                        field.onChange(
                          selected
                            ? current.filter((value: string) => value !== option)
                            : [...current, option]
                        )
                      }
                    />
                  );
                })}
              </AdminFieldGroup>
            )}
          />
        );
      })}
    </>
  );
}
