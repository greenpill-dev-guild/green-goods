import type { SmartOutcome } from "../../types/domain";
import { transitionWizardStep } from "../../hooks/admin-ui/hypercerts/wizardTransitions";
import type { CreateAssessmentFormState, CreateAssessmentStore } from "../useCreateAssessmentStore";

export function setAssessmentFieldTransition<K extends keyof CreateAssessmentFormState>(
  state: CreateAssessmentStore,
  input: { field: K; value: CreateAssessmentFormState[K] }
): Partial<CreateAssessmentStore> {
  return { form: { ...state.form, [input.field]: input.value } };
}

export function addSmartOutcomeTransition(
  state: CreateAssessmentStore
): Partial<CreateAssessmentStore> {
  return {
    form: {
      ...state.form,
      smartOutcomes: [...state.form.smartOutcomes, { description: "", metric: "", target: 0 }],
    },
  };
}

export function removeSmartOutcomeTransition(
  state: CreateAssessmentStore,
  index: number
): Partial<CreateAssessmentStore> {
  return {
    form: {
      ...state.form,
      smartOutcomes: state.form.smartOutcomes.filter((_, item) => item !== index),
    },
  };
}

export function updateSmartOutcomeTransition<K extends keyof SmartOutcome>(
  state: CreateAssessmentStore,
  input: { index: number; field: K; value: SmartOutcome[K] }
): Partial<CreateAssessmentStore> {
  return {
    form: {
      ...state.form,
      smartOutcomes: state.form.smartOutcomes.map((outcome, index) =>
        index === input.index ? { ...outcome, [input.field]: input.value } : outcome
      ),
    },
  };
}

export function moveAssessmentStepTransition(
  state: CreateAssessmentStore,
  input: { direction?: -1 | 1; index?: number; totalSteps: number }
): Partial<CreateAssessmentStore> {
  const event =
    input.index !== undefined
      ? ({ type: "GO_TO", step: input.index } as const)
      : input.direction === 1
        ? ({ type: "NEXT" } as const)
        : input.direction === -1
          ? ({ type: "PREVIOUS" } as const)
          : ({ type: "GO_TO", step: state.currentStep } as const);
  return {
    currentStep: transitionWizardStep(state.currentStep, event, {
      first: 0,
      last: input.totalSteps - 1,
    }),
  };
}

export function resetAssessmentTransition(
  _state: CreateAssessmentStore,
  form: CreateAssessmentFormState
): Partial<CreateAssessmentStore> {
  return { form, currentStep: 0 };
}
