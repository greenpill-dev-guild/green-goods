import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { CapitalsCheckboxGroup } from "./CapitalsCheckboxGroup";
import {
  type CreateAssessmentForm,
  inputClassName,
  LabeledField,
  textareaClassName,
} from "./shared";

interface OverviewStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
}

export function OverviewStep({ register, errors, control, isSubmitting }: OverviewStepProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        <LabeledField
          label="Title"
          required
          error={errors.title?.message}
          helpText="Summarise this assessment in a few words."
        >
          <input
            type="text"
            disabled={isSubmitting}
            className={inputClassName(errors.title)}
            {...register("title")}
          />
        </LabeledField>
        <LabeledField
          label="Assessment type"
          required
          error={errors.assessmentType?.message}
          helpText="For example: remote sensing, on-site visit, community report."
        >
          <input
            type="text"
            disabled={isSubmitting}
            className={inputClassName(errors.assessmentType)}
            {...register("assessmentType")}
          />
        </LabeledField>
      </div>
      <LabeledField
        label="Description"
        required
        error={errors.description?.message}
        helpText="Provide context, goals, or key learnings from this assessment."
      >
        <textarea
          rows={3}
          disabled={isSubmitting}
          className={textareaClassName(errors.description)}
          {...register("description")}
        />
      </LabeledField>
      <CapitalsCheckboxGroup
        control={control}
        error={errors.capitals}
        disabled={isSubmitting}
      />
    </div>
  );
}
