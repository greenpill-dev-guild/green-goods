import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  type AssessmentStepId,
  assessmentStepFields,
  createAssessmentFormSchema,
  createDefaultAssessmentForm,
} from "../hooks/assessment/useCreateAssessmentForm";
import { CynefinPhase, Domain, type SmartOutcome } from "../types/domain";

// Storage key for assessment creation flow persistence
const CREATE_ASSESSMENT_STORAGE_KEY = "green-goods:create-assessment";

export interface CreateAssessmentFormState {
  title: string;
  description: string;
  location: string;
  diagnosis: string;
  smartOutcomes: SmartOutcome[];
  cynefinPhase: CynefinPhase;
  domain: Domain;
  selectedActionUIDs: string[];
  sdgTargets: number[];
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  attachments: File[];
}

export interface CreateAssessmentStore {
  form: CreateAssessmentFormState;
  currentStep: number;
  setField: <K extends keyof CreateAssessmentFormState>(
    field: K,
    value: CreateAssessmentFormState[K]
  ) => void;
  addSmartOutcome: () => void;
  removeSmartOutcome: (index: number) => void;
  updateSmartOutcome: <K extends keyof SmartOutcome>(
    index: number,
    field: K,
    value: SmartOutcome[K]
  ) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  isStepValid: (stepId: AssessmentStepId) => boolean;
  reset: () => void;
}

const TOTAL_STEPS = 3;

function createEmptyAssessmentForm(): CreateAssessmentFormState {
  const defaults = createDefaultAssessmentForm();
  return {
    title: defaults.title,
    description: defaults.description,
    location: defaults.location,
    diagnosis: defaults.diagnosis,
    smartOutcomes: defaults.smartOutcomes,
    cynefinPhase: defaults.cynefinPhase,
    domain: defaults.domain,
    selectedActionUIDs: defaults.selectedActionUIDs,
    sdgTargets: defaults.sdgTargets,
    reportingPeriodStart: defaults.reportingPeriodStart,
    reportingPeriodEnd: defaults.reportingPeriodEnd,
    attachments: [],
  };
}

export { createEmptyAssessmentForm };

export const useCreateAssessmentStore = create<CreateAssessmentStore>()(
  persist(
    (set, get) => ({
      form: createEmptyAssessmentForm(),
      currentStep: 0,
      setField: (field, value) =>
        set((state) => ({
          form: { ...state.form, [field]: value },
        })),
      addSmartOutcome: () =>
        set((state) => ({
          form: {
            ...state.form,
            smartOutcomes: [
              ...state.form.smartOutcomes,
              { description: "", metric: "", target: 0 },
            ],
          },
        })),
      removeSmartOutcome: (index) =>
        set((state) => ({
          form: {
            ...state.form,
            smartOutcomes: state.form.smartOutcomes.filter((_, i) => i !== index),
          },
        })),
      updateSmartOutcome: (index, field, value) =>
        set((state) => ({
          form: {
            ...state.form,
            smartOutcomes: state.form.smartOutcomes.map((outcome, i) =>
              i === index ? { ...outcome, [field]: value } : outcome
            ),
          },
        })),
      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS - 1),
        })),
      previousStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),
      goToStep: (index) =>
        set(() => ({
          currentStep: Math.min(Math.max(index, 0), TOTAL_STEPS - 1),
        })),
      isStepValid: (stepId) => {
        const { form } = get();
        const fields = assessmentStepFields[stepId];
        if (!fields) return false;
        const parseResult = createAssessmentFormSchema.safeParse(form);
        if (parseResult.success) return true;

        const stepFieldSet = new Set<string>(fields);
        return parseResult.error.issues.every((issue) => !stepFieldSet.has(String(issue.path[0])));
      },
      reset: () =>
        set({
          form: createEmptyAssessmentForm(),
          currentStep: 0,
        }),
    }),
    {
      name: CREATE_ASSESSMENT_STORAGE_KEY,
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      // Exclude attachments (File objects can't be serialized to JSON)
      partialize: (state) =>
        ({
          form: { ...state.form, attachments: [] as File[] },
          currentStep: state.currentStep,
        }) as CreateAssessmentStore,
    }
  )
);

export function resetCreateAssessmentStore() {
  useCreateAssessmentStore.setState({
    form: createEmptyAssessmentForm(),
    currentStep: 0,
  });
  sessionStorage.removeItem(CREATE_ASSESSMENT_STORAGE_KEY);
}
