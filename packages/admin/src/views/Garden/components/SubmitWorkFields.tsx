import {
  normalizeNumberDetail,
  type useWorkForm,
  WORK_FORM_ERROR_IDS,
} from "@green-goods/shared/hooks/work/useWorkForm";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";

/** What the work form says about a field, as a steward reads it. */
const DETAIL_ERROR_MESSAGES: {
  [Rule in keyof typeof WORK_FORM_ERROR_IDS]: {
    id: (typeof WORK_FORM_ERROR_IDS)[Rule];
    defaultMessage: string;
  };
} = {
  required: { id: "app.work.form.error.required", defaultMessage: "This field is required" },
  belowZero: { id: "app.work.form.error.belowZero", defaultMessage: "Enter 0 or more" },
};

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
  const errorText = (key: string) => {
    if (!showValidation && !leftFields[key]) return undefined;
    const message = errors[key]?.message;
    const known = Object.values(DETAIL_ERROR_MESSAGES).find((entry) => entry.id === message);
    return known ? formatMessage(known) : message;
  };
  if (inputs.length === 0) return null;

  return (
    <>
      {inputs.map((input) => {
        const error = errorText(input.key);
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
                {/* Next sends focus to the first field that needs a value; here that is the
                    first chip. The group is left once focus moves out of it, not between chips. */}
                <div
                  className="flex flex-wrap gap-2"
                  ref={(group) =>
                    field.ref(group && { focus: () => group.querySelector("button")?.focus() })
                  }
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
