/**
 * Work Form Hook
 *
 * Manages the work submission form with react-hook-form and Zod validation.
 * Provides form state, validation, and field watchers.
 *
 * @module hooks/work/useWorkForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { normalizePlantCount, normalizePlantSelection } from "../../utils/form/normalizers";

/**
 * Zod schema for work submission form validation
 * Note: Only validating form fields (feedback, plantSelection, plantCount)
 * actionUID, title, and media are managed outside the form
 *
 * Uses shared normalizers from utils/form/normalizers.ts for consistency
 * between Zod validation and watch() value normalization.
 */
export const workFormSchema = z.object({
  feedback: z.string().optional().default(""),
  plantSelection: z.preprocess(normalizePlantSelection, z.array(z.string())),
  plantCount: z.preprocess(normalizePlantCount, z.number().nonnegative().optional()),
});

// Infer base form type from Zod schema
type WorkFormDataBase = z.infer<typeof workFormSchema>;

// Extend with index signature for dynamic action-specific fields
export type WorkFormData = WorkFormDataBase & {
  [key: string]: string | number | string[] | undefined;
};

/**
 * Hook to manage the work submission form
 *
 * @returns Form instance with control, register, watch, etc.
 */
export function useWorkForm() {
  const form = useForm<WorkFormData>({
    defaultValues: {
      feedback: "",
      plantSelection: [],
      // plantCount is optional
    },
    // Native validation disabled to prevent jarring auto-focus behavior
    shouldUseNativeValidation: false,
    mode: "onChange",
    // Compatibility note: older @hookform/resolvers versions had a signature mismatch with Zod.
    // Current versions compile cleanly; keeping the context here for future regressions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(workFormSchema as any),
  });

  const { watch } = form;

  // Watch form values and normalize using shared utilities
  // This ensures consistency between watched values and Zod validation
  const feedback = watch("feedback") ?? "";
  const plantSelection = normalizePlantSelection(watch("plantSelection"));
  const plantCount = normalizePlantCount(watch("plantCount"));
  const values = watch() as unknown as Record<string, unknown>;

  return {
    ...form,
    // Normalized watch values
    feedback,
    plantSelection,
    plantCount,
    values,
  };
}

export type UseWorkFormReturn = ReturnType<typeof useWorkForm>;
