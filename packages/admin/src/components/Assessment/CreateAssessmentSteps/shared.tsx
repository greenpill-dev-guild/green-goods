import { cn, type CynefinPhase, Domain } from "@green-goods/shared";
import type { ReactNode } from "react";
import { type FieldError, type FieldErrorsImpl } from "react-hook-form";
import { z } from "zod";

// ============================================
// Schema — mirrors AssessmentDraft from shared types
// ============================================

const smartOutcomeSchema = z.object({
  description: z.string().trim().min(1, "Outcome description is required"),
  metric: z.string().trim().min(1, "Select a metric"),
  target: z.coerce.number().positive("Target must be a positive number"),
});

const baseAssessmentSchema = z.object({
  // Common
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  location: z.string().trim().min(1, "Location is required"),

  // Step 1: Strategy kernel
  diagnosis: z.string().trim().min(10, "Provide a root-cause diagnosis (at least 10 characters)"),
  smartOutcomes: z.array(smartOutcomeSchema).min(1, "Add at least one SMART outcome"),
  cynefinPhase: z.coerce.number().min(0).max(3),

  // Step 2: Domain + action set
  domain: z.coerce.number().min(0).max(3),
  selectedActionUIDs: z.array(z.string().trim().min(1)).min(1, "Select at least one action"),

  // Step 3: SDG + harvest
  sdgTargets: z.array(z.coerce.number().min(1).max(17)).min(1, "Select at least one SDG target"),
  reportingPeriodStart: z.string().trim().min(1, "Start date is required"),
  reportingPeriodEnd: z.string().trim().min(1, "End date is required"),

  // Attachments (optional)
  attachments: z.array(z.instanceof(File)).optional().default([]),
});

export const createAssessmentSchema = baseAssessmentSchema.superRefine((data, ctx) => {
  // Validate reporting period dates
  const startDate = new Date(data.reportingPeriodStart);
  startDate.setUTCHours(0, 0, 0, 0);
  const startTimestamp = startDate.getTime();

  if (Number.isNaN(startTimestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date is invalid",
      path: ["reportingPeriodStart"],
    });
  }

  const endDate = new Date(data.reportingPeriodEnd);
  endDate.setUTCHours(0, 0, 0, 0);
  const endTimestamp = endDate.getTime();

  if (Number.isNaN(endTimestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date is invalid",
      path: ["reportingPeriodEnd"],
    });
  }

  if (
    !Number.isNaN(startTimestamp) &&
    !Number.isNaN(endTimestamp) &&
    endTimestamp < startTimestamp
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date",
      path: ["reportingPeriodEnd"],
    });
  }
});

export type CreateAssessmentForm = z.infer<typeof baseAssessmentSchema>;

export function createDefaultAssessmentForm(): CreateAssessmentForm {
  return {
    title: "",
    description: "",
    location: "",
    diagnosis: "",
    smartOutcomes: [{ description: "", metric: "", target: 0 }],
    cynefinPhase: 0 as CynefinPhase,
    domain: Domain.SOLAR,
    selectedActionUIDs: [],
    sdgTargets: [],
    reportingPeriodStart: "",
    reportingPeriodEnd: "",
    attachments: [],
  };
}

// ============================================
// Helper components (reused across steps)
// ============================================

interface LabeledFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
}

export function LabeledField({ label, required, error, helpText, children }: LabeledFieldProps) {
  return (
    <label className="space-y-0.5 text-sm">
      <span className="font-medium text-text-sub">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {helpText ? <span className="block text-xs text-text-soft">{helpText}</span> : null}
      {children}
      {/* Always render to reserve space and prevent layout shift */}
      <span className="block min-h-[1.25rem] text-xs text-red-600">{error || "\u00A0"}</span>
    </label>
  );
}

export const inputClassName = (error?: FieldError) =>
  cn(
    "mt-1 w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
    error && "border-red-300 focus:border-red-400 focus:ring-red-100/60"
  );

export const textareaClassName = (error?: FieldError) =>
  cn(
    "mt-1 w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
    error && "border-red-300 focus:border-red-400 focus:ring-red-100/60"
  );

export function extractErrorMessage(error?: FieldError | FieldErrorsImpl<any>): string | undefined {
  if (!error) {
    return undefined;
  }

  const message = (error as FieldError).message ?? (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text-strong">{title}</h3>
        <p className="mt-0.5 text-sm text-text-soft">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ReviewRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-text-soft">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm text-text-sub",
          multiline ? "whitespace-pre-wrap break-words" : "truncate"
        )}
      >
        {value && value.trim().length > 0 ? value : "Not provided"}
      </p>
    </div>
  );
}

export function formatDateRange(start?: string | number | null, end?: string | number | null) {
  if (!start && !end) return "Not provided";

  const formatValue = (value?: string | number | null) => {
    if (!value) return undefined;
    if (typeof value === "string" && value.includes("-")) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
    }
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!numeric) return undefined;
    const timestamp = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
  };

  const startLabel = formatValue(start);
  const endLabel = formatValue(end);

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel ?? endLabel ?? "Not provided";
}

// ============================================
// Step field mappings for per-step validation
// ============================================

/** Fields validated on each wizard step (used for trigger validation) */
export const STEP_FIELDS = {
  strategy: ["title", "description", "location", "diagnosis", "smartOutcomes", "cynefinPhase"],
  domain: ["domain", "selectedActionUIDs"],
  sdgHarvest: ["sdgTargets", "reportingPeriodStart", "reportingPeriodEnd"],
} as const satisfies Record<string, readonly (keyof CreateAssessmentForm)[]>;
