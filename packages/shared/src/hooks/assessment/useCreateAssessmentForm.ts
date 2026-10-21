import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  type CreateAssessmentFormInput,
  type CreateAssessmentFormOutput,
  createAssessmentFormSchema,
  createDefaultAssessmentForm,
} from "../../modules/assessment/create-form";

export {
  type AssessmentStepId,
  type CreateAssessmentFormData,
  createAssessmentFormSchema,
  createDefaultAssessmentForm,
  assessmentStepFields,
} from "../../modules/assessment/create-form";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreateAssessmentForm() {
  return useForm<CreateAssessmentFormInput, unknown, CreateAssessmentFormOutput>({
    resolver: zodResolver(createAssessmentFormSchema),
    mode: "onTouched",
    defaultValues: createDefaultAssessmentForm(),
  });
}

export type UseCreateAssessmentFormReturn = ReturnType<typeof useCreateAssessmentForm>;
