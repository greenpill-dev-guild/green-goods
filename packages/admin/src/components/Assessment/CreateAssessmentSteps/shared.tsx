import { cn, CynefinPhase, Domain } from "@green-goods/shared";
import { type ReactNode } from "react";
import {
  type FieldError,
  type FieldErrorsImpl,
} from "react-hook-form";
import { useIntl, type IntlShape } from "react-intl";
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────

const smartOutcomeSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  metric: z.string().trim().min(1, "Select a metric"),
  target: z.number({ invalid_type_error: "Target must be a number" }).min(0, "Target must be positive"),
});

/**
 * Base schema for type inference (no superRefine so z.infer works cleanly).
 * The runtime schema returned by `createAssessmentSchema()` adds cross-field
 * validation on top of this.
 */
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
  attachments: z.array(z.instanceof(File)).optional().default([]),
});

export type CreateAssessmentForm = z.infer<typeof baseAssessmentSchema>;

/**
 * Factory that builds the full Zod schema with i18n validation messages.
 * Called as `createAssessmentSchema(intl)` from the view component.
 */
export function createAssessmentSchema(intl: IntlShape) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.titleRequired", defaultMessage: "Title is required" })),
      description: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.descriptionRequired", defaultMessage: "Description is required" })),
      location: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.locationRequired", defaultMessage: "Location is required" })),
      diagnosis: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.diagnosisRequired", defaultMessage: "Diagnosis is required" })),
      smartOutcomes: z
        .array(smartOutcomeSchema)
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.smartOutcomesRequired", defaultMessage: "At least one SMART outcome is required" })),
      cynefinPhase: z.nativeEnum(CynefinPhase),
      domain: z.nativeEnum(Domain),
      selectedActionUIDs: z.array(z.string()),
      sdgTargets: z
        .array(z.number())
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.sdgRequired", defaultMessage: "Select at least one SDG target" })),
      reportingPeriodStart: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.reportingStartRequired", defaultMessage: "Start date is required" })),
      reportingPeriodEnd: z
        .string()
        .trim()
        .min(1, intl.formatMessage({ id: "app.admin.assessment.validation.reportingEndRequired", defaultMessage: "End date is required" })),
      attachments: z.array(z.instanceof(File)).optional().default([]),
    })
    .superRefine((data, ctx) => {
      // Normalize dates to midnight UTC to avoid timezone comparison issues
      const startDate = new Date(data.reportingPeriodStart);
      startDate.setUTCHours(0, 0, 0, 0);
      const startTimestamp = startDate.getTime();

      if (Number.isNaN(startTimestamp)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: intl.formatMessage({ id: "app.admin.assessment.validation.startDateInvalid", defaultMessage: "Start date is invalid" }),
          path: ["reportingPeriodStart"],
        });
      }

      const endDate = new Date(data.reportingPeriodEnd);
      endDate.setUTCHours(0, 0, 0, 0);
      const endTimestamp = endDate.getTime();

      if (Number.isNaN(endTimestamp)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: intl.formatMessage({ id: "app.admin.assessment.validation.endDateInvalid", defaultMessage: "End date is invalid" }),
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
          message: intl.formatMessage({ id: "app.admin.assessment.validation.endBeforeStart", defaultMessage: "End date must be after start date" }),
          path: ["reportingPeriodEnd"],
        });
      }
    });
}

export function createDefaultAssessmentForm(): CreateAssessmentForm {
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

// ─── Step Field Mapping ──────────────────────────────────

/**
 * Maps wizard step IDs to their form field names.
 * Used by FormWizard's per-step validation trigger.
 */
export const STEP_FIELDS: Record<string, readonly (keyof CreateAssessmentForm)[]> = {
  strategy: ["title", "description", "location", "diagnosis", "smartOutcomes", "cynefinPhase"],
  domain: ["domain", "selectedActionUIDs"],
  sdgHarvest: ["sdgTargets", "reportingPeriodStart", "reportingPeriodEnd"],
};

// ─── Helper Components ───────────────────────────────────

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
  const intl = useIntl();
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-text-soft">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm text-text-sub",
          multiline ? "whitespace-pre-wrap break-words" : "truncate"
        )}
      >
        {value && value.trim().length > 0 ? value : intl.formatMessage({ id: "admin.assessment.review.notProvided", defaultMessage: "Not provided" })}
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
