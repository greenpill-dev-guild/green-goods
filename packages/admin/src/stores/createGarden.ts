import { create } from "zustand";

import type { CreateGardenParams } from "@/types/contracts";

export interface CreateGardenFormState {
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  communityToken: string;
  gardeners: string[];
  operators: string[];
}

export interface CreateGardenStep {
  id: "details" | "team" | "review";
  title: string;
  description: string;
}

export interface CreateGardenStore {
  form: CreateGardenFormState;
  steps: CreateGardenStep[];
  currentStep: number;
  setField: <K extends keyof CreateGardenFormState>(field: K, value: CreateGardenFormState[K]) => void;
  addGardener: (address: string) => { success: boolean; error?: string };
  removeGardener: (index: number) => void;
  addOperator: (address: string) => { success: boolean; error?: string };
  removeOperator: (index: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  goToReview: () => void;
  goToFirstIncompleteStep: () => void;
  isStepValid: (stepId: CreateGardenStep["id"]) => boolean;
  canProceed: () => boolean;
  isReviewReady: () => boolean;
  reset: () => void;
  getParams: () => CreateGardenParams | null;
}

export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const defaultSteps: CreateGardenStep[] = [
  {
    id: "details",
    title: "Garden details",
    description: "Define the basics for your onchain garden.",
  },
  {
    id: "team",
    title: "Community",
    description: "Invite gardeners and operators who can help steward the garden.",
  },
  {
    id: "review",
    title: "Review & deploy",
    description: "Confirm the information before deploying the garden attestation.",
  },
];

export function createEmptyGardenForm(): CreateGardenFormState {
  return {
    name: "",
    description: "",
    location: "",
    bannerImage: "",
    communityToken: "",
    gardeners: [],
    operators: [],
  };
}

function sanitizeAddress(address: string) {
  return address.trim();
}

export function isValidAddress(address: string) {
  return ADDRESS_REGEX.test(address);
}

export const useCreateGardenStore = create<CreateGardenStore>((set, get) => ({
  form: createEmptyGardenForm(),
  steps: defaultSteps,
  currentStep: 0,
  setField: (field, value) =>
    set((state) => ({
      form: {
        ...state.form,
        [field]: typeof value === "string" ? value : value,
      },
    })),
  addGardener: (address) => {
    const sanitized = sanitizeAddress(address);
    if (!isValidAddress(sanitized)) {
      return { success: false, error: "Enter a valid wallet address" };
    }

    set((state) => {
      if (state.form.gardeners.includes(sanitized)) {
        return state;
      }
      return {
        form: {
          ...state.form,
          gardeners: [...state.form.gardeners, sanitized],
        },
      };
    });

    return { success: true };
  },
  removeGardener: (index) =>
    set((state) => ({
      form: {
        ...state.form,
        gardeners: state.form.gardeners.filter((_, i) => i !== index),
      },
    })),
  addOperator: (address) => {
    const sanitized = sanitizeAddress(address);
    if (!isValidAddress(sanitized)) {
      return { success: false, error: "Enter a valid wallet address" };
    }

    set((state) => {
      if (state.form.operators.includes(sanitized)) {
        return state;
      }
      return {
        form: {
          ...state.form,
          operators: [...state.form.operators, sanitized],
        },
      };
    });

    return { success: true };
  },
  removeOperator: (index) =>
    set((state) => ({
      form: {
        ...state.form,
        operators: state.form.operators.filter((_, i) => i !== index),
      },
    })),
  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, state.steps.length - 1),
    })),
  previousStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),
  goToStep: (index) =>
    set((state) => ({
      currentStep: Math.min(Math.max(index, 0), state.steps.length - 1),
    })),
  goToReview: () =>
    set((state) => ({
      currentStep: state.steps.length - 1,
    })),
  goToFirstIncompleteStep: () => {
    const { steps } = get();
    for (let i = 0; i < steps.length - 1; i++) {
      const step = steps[i];
      if (!get().isStepValid(step.id)) {
        set({ currentStep: i });
        return;
      }
    }
    set({ currentStep: steps.length - 2 });
  },
  isStepValid: (stepId) => {
    const { form } = get();
    switch (stepId) {
      case "details":
        return (
          form.name.trim().length > 0 &&
          form.description.trim().length > 0 &&
          form.location.trim().length > 0 &&
          isValidAddress(form.communityToken.trim())
        );
      case "team":
        return form.gardeners.length > 0;
      case "review":
        return true;
      default:
        return false;
    }
  },
  canProceed: () => {
    const { steps, currentStep } = get();
    return get().isStepValid(steps[currentStep]?.id ?? "details");
  },
  isReviewReady: () => {
    const { steps } = get();
    return steps.slice(0, steps.length - 1).every((step) => get().isStepValid(step.id));
  },
  reset: () =>
    set({
      form: createEmptyGardenForm(),
      currentStep: 0,
    }),
  getParams: () => {
    const { form } = get();
    if (!get().isReviewReady()) {
      return null;
    }

    return {
      communityToken: form.communityToken.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      bannerImage: form.bannerImage.trim(),
      gardeners: form.gardeners,
      gardenOperators: form.operators,
    } satisfies CreateGardenParams;
  },
}));

export function resetCreateGardenStore() {
  useCreateGardenStore.setState({
    form: createEmptyGardenForm(),
    steps: defaultSteps,
    currentStep: 0,
  });
}
