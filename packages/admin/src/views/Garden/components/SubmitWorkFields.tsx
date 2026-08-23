import {
  FormField,
  NativeSelect,
  Textarea,
  type useWorkForm,
  type WorkInput,
} from "@green-goods/shared";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";

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
              variant="outlined"
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
            <FormField
              key={input.key}
              label={input.title}
              htmlFor={input.key}
              required={input.required}
              error={error}
            >
              <Textarea
                surface="admin"
                id={input.key}
                rows={3}
                placeholder={input.placeholder}
                aria-invalid={!!error}
                invalid={!!error}
                className="resize-y"
                {...register(input.key)}
              />
            </FormField>
          );
        }
        if (input.type === "select" || input.type === "band") {
          const options = input.type === "band" ? (input.bands ?? []) : (input.options ?? []);
          return (
            <FormField
              key={input.key}
              label={input.title}
              htmlFor={input.key}
              required={input.required}
              error={error}
            >
              <NativeSelect
                surface="admin"
                id={input.key}
                aria-invalid={!!error}
                invalid={!!error}
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
              </NativeSelect>
            </FormField>
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
              <FormField label={input.title} required={input.required} error={error}>
                <div className="flex flex-wrap gap-2">
                  {(input.options ?? []).map((option) => {
                    const current = Array.isArray(field.value)
                      ? field.value.filter((value): value is string => typeof value === "string")
                      : [];
                    const selected = current.includes(option);
                    return (
                      <AdminButton
                        key={option}
                        type="button"
                        variant={selected ? "tonal" : "outlined"}
                        size="sm"
                        onClick={() =>
                          field.onChange(
                            selected
                              ? current.filter((value: string) => value !== option)
                              : [...current, option]
                          )
                        }
                        className="rounded-full px-3 py-1"
                      >
                        {option}
                      </AdminButton>
                    );
                  })}
                </div>
              </FormField>
            )}
          />
        );
      })}
    </>
  );
}
