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

/**
 * Zod schema for work submission form validation
 * Note: Only validating form fields (feedback, plantSelection, plantCount)
 * actionUID, title, and media are managed outside the form
 */
export const workFormSchema = z.object({
  feedback: z.string().min(1, "Feedback is required"),
  plantSelection: z.preprocess((val) => {
    if (Array.isArray(val)) {
      return val.filter((item) => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }, z.array(z.string())),
  plantCount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) {
      return undefined;
    }
    if (typeof val === "number") {
      return Number.isNaN(val) ? undefined : val;
    }
    if (typeof val === "string") {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }, z.number().nonnegative().optional()),
});

// Infer form type from Zod schema (single source of truth)
export type WorkFormData = z.infer<typeof workFormSchema>;

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
    shouldUseNativeValidation: true,
    mode: "onChange",
    // Compatibility note: older @hookform/resolvers versions had a signature mismatch with Zod.
    // Current versions compile cleanly; keeping the context here for future regressions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(workFormSchema as any),
  });

  const { watch } = form;

  // Watch form values
  const feedback = watch("feedback");
  const plantSelectionRaw = watch("plantSelection");
  const plantCountRaw = watch("plantCount");

  // Normalize plant selection
  const plantSelection = Array.isArray(plantSelectionRaw)
    ? (plantSelectionRaw as string[])
    : typeof plantSelectionRaw === "string" && (plantSelectionRaw as string).trim().length > 0
      ? [(plantSelectionRaw as string).trim()]
      : [];

  // Normalize plant count
  const plantCount =
    typeof plantCountRaw === "number"
      ? plantCountRaw
      : typeof plantCountRaw === "string" && (plantCountRaw as string).trim().length > 0
        ? (() => {
            const parsed = Number(plantCountRaw as string);
            return Number.isNaN(parsed) ? undefined : parsed;
          })()
        : undefined;

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
