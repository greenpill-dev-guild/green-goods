/**
 * Work Form Hook
 *
 * Manages the work submission form with react-hook-form and Zod validation.
 * Supports dynamic schema generation from WorkInput[] config.
 *
 * @module hooks/work/useWorkForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import type { WorkInput } from "../../types/domain";
import { normalizeTimeSpentMinutes } from "../../utils/form/normalizers";

/**
 * Builds a Zod validator for a single WorkInput field.
 */
function buildFieldValidator(input: WorkInput): z.ZodTypeAny {
  switch (input.type) {
    case "number": {
      const base = z.preprocess(Number, z.number().min(0));
      return input.required ? base : base.optional();
    }
    case "select":
    case "band": {
      const base = z.string().min(1);
      return input.required ? base : z.string().optional();
    }
    case "multi-select": {
      const base = z.array(z.string());
      return input.required ? base.min(1) : base.optional();
    }
    case "repeater": {
      const rowShape: Record<string, z.ZodTypeAny> = {};
      for (const field of input.repeaterFields ?? []) {
        rowShape[field.key] = buildFieldValidator(field);
      }
      return z.array(z.object(rowShape)).optional();
    }
    default: {
      // text, textarea
      const base = z.string();
      return input.required ? base.min(1) : base.optional();
    }
  }
}

/**
 * Builds a dynamic Zod schema from an action's WorkInput[] config.
 *
 * Fixed fields (always present):
 * - feedback (optional string)
 * - timeSpentMinutes (required, user inputs hours, normalized to minutes)
 *
 * Dynamic fields from action config:
 * - number, select, multi-select, band, text, textarea, repeater
 */
export function buildWorkFormSchema(inputs: WorkInput[]) {
  const shape: Record<string, z.ZodTypeAny> = {
    feedback: z.string().optional().default(""),
    timeSpentMinutes: z.preprocess(normalizeTimeSpentMinutes, z.number().nonnegative().optional()),
  };

  for (const input of inputs) {
    shape[input.key] = buildFieldValidator(input);
  }

  return z.object(shape);
}

/**
 * Static schema for backward compatibility (no dynamic inputs).
 * Used when no action-specific inputs are provided.
 */
export const workFormSchema = buildWorkFormSchema([]);

// Infer base form type from Zod schema
type WorkFormDataBase = z.infer<typeof workFormSchema>;

// Extend with index signature for dynamic action-specific fields
export type WorkFormData = WorkFormDataBase & {
  [key: string]: string | number | string[] | Record<string, unknown>[] | undefined;
};

/**
 * Hook to manage the work submission form
 *
 * @param inputs - Optional WorkInput[] from the selected action's config.
 *   When provided, the form schema is dynamically generated.
 * @returns Form instance with control, register, watch, etc.
 */
export function useWorkForm(inputs?: WorkInput[]) {
  // Memoize schema to avoid rebuilding on every render.
  // JSON.stringify stabilizes the dependency since inputs may be a new array reference each render.
  const inputsKey = inputs ? JSON.stringify(inputs) : "";
  const schema = useMemo(
    () => (inputs ? buildWorkFormSchema(inputs) : workFormSchema),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inputsKey is the stable serialization of inputs
    [inputsKey]
  );
  const resolver = useMemo(() => zodResolver(schema) as Resolver<WorkFormData>, [schema]);

  const form = useForm<WorkFormData>({
    defaultValues: {
      feedback: "",
    },
    // Native validation disabled to prevent jarring auto-focus behavior
    shouldUseNativeValidation: false,
    mode: "onChange",
    resolver,
  });

  const { watch, getValues } = form;

  // Watch only specific fields that need reactive updates
  const feedback = watch("feedback") ?? "";
  const watchedTimeSpent = watch("timeSpentMinutes");
  const timeSpentMinutes =
    typeof watchedTimeSpent === "string"
      ? normalizeTimeSpentMinutes(watchedTimeSpent)
      : typeof watchedTimeSpent === "number" && watchedTimeSpent >= 0
        ? watchedTimeSpent
        : undefined;

  return {
    ...form,
    // Normalized watch values
    feedback,
    timeSpentMinutes,
    // Use getValues() instead of watch() to read all form values on demand
    // without subscribing to every field change (avoids unnecessary re-renders)
    get values() {
      return getValues() as unknown as Record<string, unknown>;
    },
  };
}

export type UseWorkFormReturn = ReturnType<typeof useWorkForm>;
