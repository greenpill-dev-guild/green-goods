import { cn } from "@green-goods/shared/utils";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import {
  type Control,
  type FieldError,
  type FieldErrorsImpl,
  type Path,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

// Schema and types
const stringListSchema = z
  .array(z.string().trim())
  .optional()
  .default([])
  .transform((values) => values.filter((value) => value.trim().length > 0));

const baseAssessmentSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z
    .string()
    .trim()
    .min(1, "Describe what was evaluated or the key findings for this assessment"),
  assessmentType: z.string().trim().min(1, "Assessment type is required"),
  capitals: z.array(z.string().trim()).default([]),
  metrics: z
    .string()
    .trim()
    .min(2, "Provide assessment metrics")
    .refine((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, "Metrics must be valid JSON"),
  reportDocuments: stringListSchema,
  impactAttestations: stringListSchema,
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  location: z.string().trim().min(1, "Location is required"),
  tags: stringListSchema,
  evidenceMedia: z.array(z.any()).optional().default([]),
});

export const createAssessmentSchema = baseAssessmentSchema.superRefine((data, ctx) => {
  if (data.capitals.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one form of capital",
      path: ["capitals"],
    });
  }

  // Normalize dates to midnight UTC to avoid timezone comparison issues
  const startDate = new Date(data.startDate);
  startDate.setUTCHours(0, 0, 0, 0);
  const startTimestamp = startDate.getTime();

  if (Number.isNaN(startTimestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date is invalid",
      path: ["startDate"],
    });
  }

  const endDate = new Date(data.endDate);
  endDate.setUTCHours(0, 0, 0, 0);
  const endTimestamp = endDate.getTime();

  if (Number.isNaN(endTimestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date is invalid",
      path: ["endDate"],
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
      path: ["endDate"],
    });
  }

  const invalidAttestations = data.impactAttestations.filter(
    (value) => !/^0x[a-fA-F0-9]{64}$/.test(value)
  );
  if (invalidAttestations.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each impact attestation must be a 32-byte hex string (0x...)",
      path: ["impactAttestations"],
    });
  }
});

type CreateAssessmentFormValues = z.infer<typeof createAssessmentSchema>;

export type CreateAssessmentForm = CreateAssessmentFormValues & {
  evidenceMedia: File[];
  metrics: string;
};

export function createDefaultAssessmentForm(): CreateAssessmentForm {
  return {
    title: "",
    description: "",
    assessmentType: "",
    capitals: [],
    metrics: '{\n  "indicators": []\n}',
    reportDocuments: [],
    impactAttestations: [],
    startDate: "",
    endDate: "",
    location: "",
    tags: [],
    evidenceMedia: [],
  };
}

// Helper components
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

interface ArrayInputProps<TName extends Path<CreateAssessmentFormValues>> {
  control: Control<CreateAssessmentFormValues>;
  name: TName;
  label: string;
  placeholder?: string;
  helper?: string;
  emptyHint?: string;
  addLabel?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  transformValue?: (value: string) => string;
}

export function ArrayInput<TName extends Path<CreateAssessmentFormValues>>({
  control,
  name,
  label,
  placeholder,
  helper,
  emptyHint,
  addLabel = "Add entry",
  required,
  disabled,
  error,
  transformValue,
}: ArrayInputProps<TName>) {
  const { fields, append, remove } = useFieldArray({
    control: control as any,
    name,
  });
  const values = (useWatch({ control, name }) as string[] | undefined) ?? [];
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    append(transformValue ? transformValue(trimmed) : (trimmed as any));
    setInputValue("");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-sm">
        <span className="font-medium text-text-sub">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
        {helper ? <span className="block text-xs text-text-soft">{helper}</span> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          className={cn(
            "flex-1 rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
            error && "border-red-300 focus:border-red-400 focus:ring-red-100/60"
          )}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || inputValue.trim().length === 0}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RiAddLine className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      {/* Always render to reserve space and prevent layout shift */}
      <span className="block min-h-[1.25rem] text-xs text-red-600">{error || "\u00A0"}</span>
      <div className="space-y-1.5">
        {fields.length === 0
          ? emptyHint && <p className="text-xs text-text-soft">{emptyHint}</p>
          : fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center justify-between gap-2.5 rounded-md border border-gray-100 bg-bg-weak px-3 py-2 text-sm text-text-sub/60"
              >
                <span className="break-all">{values[index] ?? ""}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Remove ${label.toLowerCase()} entry`}
                >
                  <RiDeleteBinLine className="h-4 w-4" />
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}

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
