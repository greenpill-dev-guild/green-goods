import { getAddress, isAddress } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  createGardenSchema,
  gardenStepFields,
  type GardenStepId,
} from "../hooks/garden/useCreateGardenForm";
import type { Address } from "../types/domain";
import { type CreateGardenParams, WeightScheme } from "../types/contracts";

// Storage key for garden creation flow persistence
const CREATE_GARDEN_STORAGE_KEY = "green-goods:create-garden";

export interface CreateGardenFormState {
  name: string;
  slug: string;
  description: string;
  location: string;
  bannerImage: string;
  metadata: string;
  openJoining: boolean;
  gardeners: Address[];
  operators: Address[];
}

export interface CreateGardenStep {
  id: "details" | "team" | "review";
  title: string;
  description?: string;
}

export interface CreateGardenStore {
  form: CreateGardenFormState;
  steps: CreateGardenStep[];
  currentStep: number;
  setField: <K extends keyof CreateGardenFormState>(
    field: K,
    value: CreateGardenFormState[K]
  ) => void;
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

const defaultSteps: CreateGardenStep[] = [
  { id: "details", title: "Garden details", description: "Name, location & media" },
  { id: "team", title: "Community", description: "Gardeners & operators" },
  { id: "review", title: "Review & deploy", description: "Confirm your setup" },
];

export function createEmptyGardenForm(): CreateGardenFormState {
  return {
    name: "",
    slug: "",
    description: "",
    location: "",
    bannerImage: "",
    metadata: "",
    openJoining: false,
    gardeners: [],
    operators: [],
  };
}

/**
 * Sanitizes and normalizes an Ethereum address.
 * Returns checksummed address if valid, otherwise returns trimmed input.
 */
function sanitizeAddress(address: string): string {
  const trimmed = address.trim();
  if (isAddress(trimmed)) {
    return getAddress(trimmed); // Returns checksummed address
  }
  return trimmed;
}

/**
 * Validates an Ethereum address using viem's isAddress.
 * Accepts both checksummed and non-checksummed addresses.
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address.trim());
}

export const useCreateGardenStore = create<CreateGardenStore>()(
  persist(
    (set, get) => ({
      form: createEmptyGardenForm(),
      steps: defaultSteps,
      currentStep: 0,
      setField: (field, value) =>
        set((state) => ({
          form: {
            ...state.form,
            [field]: value,
          },
        })),
      addGardener: (address) => {
        const sanitized = sanitizeAddress(address);
        if (!isValidAddress(sanitized)) {
          return { success: false, error: "Enter a valid wallet address" };
        }

        const validAddress = sanitized as Address;
        const { form } = get();

        // Check if already a gardener (case-insensitive via checksummed comparison)
        if (form.gardeners.includes(validAddress)) {
          return { success: false, error: "Address already added as gardener" };
        }

        // Check if already an operator
        if (form.operators.includes(validAddress)) {
          return { success: false, error: "Address is already an operator" };
        }

        set((state) => ({
          form: {
            ...state.form,
            gardeners: [...state.form.gardeners, validAddress],
          },
        }));

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

        const validAddress = sanitized as Address;
        const { form } = get();

        // Check if already an operator (case-insensitive via checksummed comparison)
        if (form.operators.includes(validAddress)) {
          return { success: false, error: "Address already added as operator" };
        }

        // Check if already a gardener
        if (form.gardeners.includes(validAddress)) {
          return { success: false, error: "Address is already a gardener" };
        }

        set((state) => ({
          form: {
            ...state.form,
            operators: [...state.form.operators, validAddress],
          },
        }));

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
        if (stepId === "review") return true;
        const { form } = get();
        const fields = gardenStepFields[stepId as GardenStepId];
        if (!fields || fields.length === 0) return false;
        const parseResult = createGardenSchema.safeParse(form);
        if (parseResult.success) return true;

        const stepFields = new Set<string>(fields);
        return parseResult.error.issues.every((issue) => !stepFields.has(String(issue.path[0])));
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
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          bannerImage: form.bannerImage.trim(),
          metadata: form.metadata.trim(),
          openJoining: form.openJoining,
          weightScheme: WeightScheme.Linear,
          domainMask: 0x0f,
          gardeners: form.gardeners as `0x${string}`[],
          operators: form.operators as `0x${string}`[],
        } satisfies CreateGardenParams;
      },
    }),
    {
      name: CREATE_GARDEN_STORAGE_KEY,
      // Persist form data and current step to sessionStorage
      // Using sessionStorage so it clears when the browser tab is closed
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
      // Only persist form and currentStep, not steps (static) or functions
      partialize: (state) =>
        ({ form: state.form, currentStep: state.currentStep }) as CreateGardenStore,
    }
  )
);

export function resetCreateGardenStore() {
  useCreateGardenStore.setState({
    form: createEmptyGardenForm(),
    steps: defaultSteps,
    currentStep: 0,
  });
  // Also clear the persisted state from sessionStorage
  sessionStorage.removeItem(CREATE_GARDEN_STORAGE_KEY);
}
