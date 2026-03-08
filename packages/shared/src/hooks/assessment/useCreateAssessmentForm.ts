/**
 * Create Assessment Form Hook
 *
 * React Hook Form + Zod schema for assessment creation wizard validation.
 * Follows the same pattern as useCreateGardenForm: RHF is used ONLY for
 * trigger() validation, while Zustand holds the actual form state.
 *
 * Step components compute and display their own errors from the store;
 * the schema's error messages are never shown to users.
 *
 * @module hooks/assessment/useCreateAssessmentForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CynefinPhase, Domain } from "../../types/domain";

// ---------------------------------------------------------------------------
// Smart outcome sub-schema
// ---------------------------------------------------------------------------

const smartOutcomeSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  metric: z.string().trim().min(1, "Select a metric"),
  target: z.number().min(0, "Target must be positive"),
});

// ---------------------------------------------------------------------------
// Assessment creation schema (static English messages — never shown to users)
// ---------------------------------------------------------------------------

export const createAssessmentFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().min(1, "Description is required"),
    location: z.string().trim().min(1, "Location is required"),
    diagnosis: z.string().trim().min(1, "Diagnosis is required"),
    smartOutcomes: z.array(smartOutcomeSchema).min(1, "At least one SMART outcome is required"),
    cynefinPhase: z.nativeEnum(CynefinPhase),
    domain: z.nativeEnum(Domain),
    selectedActionUIDs: z.array(z.string()),
    sdgTargets: z.array(z.number()),
    reportingPeriodStart: z.string().trim().min(1, "Start date is required"),
    reportingPeriodEnd: z.string().trim().min(1, "End date is required"),
    attachments: z.array(z.any()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const startDate = new Date(data.reportingPeriodStart);
    startDate.setUTCHours(0, 0, 0, 0);
    const startMs = startDate.getTime();

    const endDate = new Date(data.reportingPeriodEnd);
    endDate.setUTCHours(0, 0, 0, 0);
    const endMs = endDate.getTime();

    if (data.reportingPeriodStart && Number.isNaN(startMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date is invalid",
        path: ["reportingPeriodStart"],
      });
    }

    if (data.reportingPeriodEnd && Number.isNaN(endMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date is invalid",
        path: ["reportingPeriodEnd"],
      });
    }

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["reportingPeriodEnd"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Types — inferred from the schema's inner z.object (before superRefine)
// ---------------------------------------------------------------------------

// Base schema without superRefine for clean type inference
const baseAssessmentSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string(),
  diagnosis: z.string(),
  smartOutcomes: z.array(smartOutcomeSchema),
  cynefinPhase: z.nativeEnum(CynefinPhase),
  domain: z.nativeEnum(Domain),
  selectedActionUIDs: z.array(z.string()),
  sdgTargets: z.array(z.number()),
  reportingPeriodStart: z.string(),
  reportingPeriodEnd: z.string(),
  attachments: z.array(z.any()).optional().default([]),
});

type CreateAssessmentFormInput = z.input<typeof baseAssessmentSchema>;
type CreateAssessmentFormOutput = z.output<typeof baseAssessmentSchema>;
export type CreateAssessmentFormData = CreateAssessmentFormInput;

// ---------------------------------------------------------------------------
// Per-step field maps for wizard trigger() validation
// ---------------------------------------------------------------------------

/**
 * Fields validated on each wizard step.
 * UI calls `trigger(assessmentStepFields[stepId])` to validate only the current step.
 */
export const assessmentStepFields = {
  domainContext: ["domain", "title", "description", "location"] as const,
  strategy: ["diagnosis", "smartOutcomes", "cynefinPhase"] as const,
  actionsHarvest: ["selectedActionUIDs", "reportingPeriodStart", "reportingPeriodEnd"] as const,
} satisfies Record<string, readonly (keyof CreateAssessmentFormData)[]>;

export type AssessmentStepId = keyof typeof assessmentStepFields;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export function createDefaultAssessmentForm(): CreateAssessmentFormInput {
  return {
    title: "",
    description: "",
    location: "",
    diagnosis: "",
    smartOutcomes: [{ description: "", metric: "", target: 0 }],
    cynefinPhase: CynefinPhase.CLEAR,
    domain: Domain.SOLAR,
    selectedActionUIDs: [],
    sdgTargets: [],
    reportingPeriodStart: "",
    reportingPeriodEnd: "",
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreateAssessmentForm() {
  return useForm<CreateAssessmentFormInput, unknown, CreateAssessmentFormOutput>({
    resolver: zodResolver(createAssessmentFormSchema),
    mode: "onTouched",
    defaultValues: createDefaultAssessmentForm(),
  });
}

export type UseCreateAssessmentFormReturn = ReturnType<typeof useCreateAssessmentForm>;
