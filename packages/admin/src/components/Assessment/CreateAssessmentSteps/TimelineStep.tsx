import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import {
  ArrayInput,
  type CreateAssessmentForm,
  extractErrorMessage,
  inputClassName,
  LabeledField,
} from "./shared";

interface TimelineStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
}

export function TimelineStep({ register, errors, control, isSubmitting }: TimelineStepProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        <LabeledField label="Start date" required error={errors.startDate?.message}>
          <input
            type="date"
            disabled={isSubmitting}
            className={inputClassName(errors.startDate)}
            {...register("startDate")}
          />
        </LabeledField>
        <LabeledField label="End date" required error={errors.endDate?.message}>
          <input
            type="date"
            disabled={isSubmitting}
            className={inputClassName(errors.endDate)}
            {...register("endDate")}
          />
        </LabeledField>
      </div>
      <LabeledField label="Location" required error={errors.location?.message}>
        <input
          type="text"
          disabled={isSubmitting}
          className={inputClassName(errors.location)}
          placeholder="City, coordinates, or region"
          {...register("location")}
        />
      </LabeledField>
      <ArrayInput
        control={control}
        name="tags"
        label="Tags"
        placeholder="water-quality"
        helper="Add labels to group similar assessments."
        emptyHint="No tags added."
        disabled={isSubmitting}
        error={extractErrorMessage(errors.tags)}
        addLabel="Add tag"
      />
    </div>
  );
}
