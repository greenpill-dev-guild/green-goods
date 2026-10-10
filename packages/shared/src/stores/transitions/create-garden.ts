import type { Address } from "../../types/domain";
import type { CreateGardenFormState, CreateGardenStore } from "../useCreateGardenStore";

export function setGardenFieldTransition<K extends keyof CreateGardenFormState>(
  state: CreateGardenStore,
  input: { field: K; value: CreateGardenFormState[K] }
): Partial<CreateGardenStore> {
  return { form: { ...state.form, [input.field]: input.value } };
}

export function addGardenMemberTransition(
  state: CreateGardenStore,
  input: { role: "gardeners" | "stewards"; address: Address }
): Partial<CreateGardenStore> {
  return {
    form: {
      ...state.form,
      [input.role]: [...state.form[input.role], input.address],
    },
  };
}

export function removeGardenMemberTransition(
  state: CreateGardenStore,
  input: { role: "gardeners" | "stewards"; index: number }
): Partial<CreateGardenStore> {
  return {
    form: {
      ...state.form,
      [input.role]: state.form[input.role].filter((_, index) => index !== input.index),
    },
  };
}

export function moveGardenStepTransition(
  state: CreateGardenStore,
  input: { direction?: -1 | 1; index?: number }
): Partial<CreateGardenStore> {
  const requested = input.index ?? state.currentStep + (input.direction ?? 0);
  return { currentStep: Math.min(Math.max(requested, 0), state.steps.length - 1) };
}

export function resetGardenTransition(
  _state: CreateGardenStore,
  form: CreateGardenFormState
): Partial<CreateGardenStore> {
  return { form, currentStep: 0 };
}
