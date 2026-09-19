import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import {
  useWatch,
  type Control,
  type UseFormSetValue,
  type Resolver,
  useForm,
} from "react-hook-form";
import { roundWorkLocation } from "../../modules/work/work-attachments";
/**
 * Work Form Hook
 *
 * Manages the work submission form with react-hook-form and Zod validation.
 * Supports dynamic schema generation from WorkInput[] config.
 *
 * @module hooks/work/useWorkForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
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
      const base = z.array(z.object(rowShape));
      return input.required ? base.min(1) : base.optional();
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
    location: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .transform(roundWorkLocation)
      .optional(),
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
  [key: string]:
    | string
    | number
    | string[]
    | { lat: number; lng: number }
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
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
  const { trigger } = form;

  useEffect(() => {
    void trigger();
  }, [schema, trigger]);

  // Subscribe to all fields so current action details are available to draft persistence.
  const values = form.watch();
  const feedback = values.feedback ?? "";
  const timeSpentMinutes = normalizeTimeSpentMinutes(values.timeSpentMinutes);

  return {
    ...form,
    // Normalized watch values
    feedback,
    timeSpentMinutes,
    values: values as Record<string, unknown>,
  };
}

export type UseWorkFormReturn = ReturnType<typeof useWorkForm>;

export function useWorkLocation(
  control: Control<WorkFormData>,
  setValue?: UseFormSetValue<WorkFormData>
) {
  const capturedLocation = useWatch({ control, name: "location" });
  const locationEnabled = !!capturedLocation;
  const locationRequest = useRef(0);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "denied">(
    "idle"
  );

  useEffect(
    () => () => {
      locationRequest.current++;
    },
    []
  );
  const handleLocationToggle = useCallback(() => {
    if (locationEnabled || locationStatus === "loading") {
      locationRequest.current++;
      setValue?.("location", undefined, { shouldDirty: true, shouldValidate: true });
      setLocationStatus("idle");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    const request = ++locationRequest.current;
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        setLocationStatus("success");
        // Store location data in form via setValue if available
        if (setValue) {
          setValue(
            "location",
            roundWorkLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
            { shouldDirty: true, shouldValidate: true }
          );
        }
      },
      () => {
        if (request !== locationRequest.current) return;
        setLocationStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [locationEnabled, locationStatus, setValue]);

  return { locationEnabled, locationStatus, handleLocationToggle };
}
