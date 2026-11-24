import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  type CreateGardenFormInput,
  type CreateGardenFormOutput,
  createGardenSchema,
  createDefaultGardenForm,
} from "../../modules/garden/create-form";

export {
  type GardenStepId,
  type CreateGardenFormData,
  createGardenSchema,
  createDefaultGardenForm,
  gardenStepFields,
  GARDEN_NAME_MAX_LENGTH,
  gardenNameFits,
} from "../../modules/garden/create-form";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreateGardenForm() {
  return useForm<CreateGardenFormInput, unknown, CreateGardenFormOutput>({
    resolver: zodResolver(createGardenSchema),
    mode: "onTouched",
    defaultValues: createDefaultGardenForm(),
  });
}

export type UseCreateGardenFormReturn = ReturnType<typeof useCreateGardenForm>;
