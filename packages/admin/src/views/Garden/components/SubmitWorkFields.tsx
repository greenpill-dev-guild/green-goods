import {
  normalizeNumberDetail,
  type useWorkForm,
} from "@green-goods/shared/hooks/work/useWorkForm";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { useState } from "react";
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
  showValidation,
}: {
  inputs: WorkInput[];
  control: ReturnType<typeof useWorkForm>["control"];
  register: ReturnType<typeof useWorkForm>["register"];
  errors: Record<string, { message?: string } | undefined>;
  /** Next has been pressed on this step: every field shows its error, used or not. */
  showValidation: boolean;
}) {
  const { formatMessage } = useIntl();
  // The work form checks every field as soon as an action is chosen, so an error can be waiting
  // before its field is used. Until Next is pressed, a field shows its own once it has been left.
  // The step keeps that record itself: the form changes its touchedFields in place, which the
  // app's React Compiler build cannot see.
  const [leftFields, setLeftFields] = useState<Record<string, true>>({});
  const markLeft = (key: string) =>
    setLeftFields((left) => (left[key] ? left : { ...left, [key]: true }));
  const registerField = (input: WorkInput) =>
    register(input.key, {
      onBlur: () => markLeft(input.key),
      setValueAs: input.type === "number" ? normalizeNumberDetail : undefined,
    });
  if (inputs.length === 0) return null;

  return (
    <>
      {inputs.map((input) => {
        const error =
          showValidation || leftFields[input.key] ? errors[input.key]?.message : undefined;
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
              {...registerField(input)}
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
              {...registerField(input)}
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
              {...registerField(input)}
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
              <AdminFieldGroup label={input.title} required={input.required} error={error}>
                {/* The group is left once focus moves out of it, not between its chips. */}
                <div
                  className="flex flex-wrap gap-2"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) markLeft(input.key);
                  }}
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
                </div>
              </AdminFieldGroup>
            )}
          />
        );
      })}
    </>
  );
}
