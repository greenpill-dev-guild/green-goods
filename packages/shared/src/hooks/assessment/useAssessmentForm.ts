/**
 * Assessment Form Hook
 *
 * React Hook Form + Zod schema for assessment workflow validation.
 * Validates the AssessmentWorkflowParams shape used by the XState machine.
 *
 * @module hooks/assessment/useAssessmentForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Metrics schema — accepts either a JSON string or an object
// ---------------------------------------------------------------------------

const metricsSchema = z.union([
  z.string().min(1, "Metrics are required"),
  z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, "Metrics object must not be empty"),
]);

// ---------------------------------------------------------------------------
// Date schema — accepts string (ISO/date) or number (epoch ms/s)
// ---------------------------------------------------------------------------

const dateValueSchema = z.union([z.string().min(1), z.number().positive()]);

// ---------------------------------------------------------------------------
// Assessment form schema — mirrors AssessmentWorkflowParams
// ---------------------------------------------------------------------------

const baseAssessmentFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  assessmentType: z.string().min(1, "Assessment type is required"),
  capitals: z.array(z.string()).optional().default([]),
  metrics: metricsSchema,
  evidenceMedia: z.array(z.instanceof(File)).optional().default([]),
  reportDocuments: z.array(z.string()).optional().default([]),
  impactAttestations: z.array(z.string()).optional().default([]),
  startDate: dateValueSchema,
  endDate: dateValueSchema,
  location: z.string().min(1, "Location is required"),
  tags: z.array(z.string()).optional().default([]),
  domain: z.number().min(0).max(3).optional(),
});

/**
 * Full assessment form schema with cross-field validation.
 * Ensures endDate is after startDate.
 */
export const assessmentFormSchema = baseAssessmentFormSchema.superRefine((data, ctx) => {
  const toMs = (v: string | number): number => {
    if (typeof v === "number") {
      // Heuristic: values < 10 billion are likely unix seconds, convert to ms
      return v > 10_000_000_000 ? v : v * 1000;
    }
    return new Date(v).getTime();
  };

  const startMs = toMs(data.startDate);
  const endMs = toMs(data.endDate);

  if (Number.isNaN(startMs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date is invalid",
      path: ["startDate"],
    });
  }

  if (Number.isNaN(endMs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date is invalid",
      path: ["endDate"],
    });
  }

  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date",
      path: ["endDate"],
    });
  }
});

type AssessmentFormInput = z.input<typeof assessmentFormSchema>;
type AssessmentFormOutput = z.output<typeof assessmentFormSchema>;
export type AssessmentFormData = AssessmentFormInput;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export function createDefaultAssessmentFormData(): AssessmentFormInput {
  return {
    title: "",
    description: "",
    assessmentType: "",
    capitals: [],
    metrics: "",
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: "",
    endDate: "",
    location: "",
    tags: [],
    domain: undefined,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssessmentForm() {
  return useForm<AssessmentFormInput, unknown, AssessmentFormOutput>({
    resolver: zodResolver(assessmentFormSchema),
    mode: "onChange",
    defaultValues: createDefaultAssessmentFormData(),
  });
}

export type UseAssessmentFormReturn = ReturnType<typeof useAssessmentForm>;
