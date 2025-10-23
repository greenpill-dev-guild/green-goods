import { useCreateAssessmentWorkflow } from "@green-goods/shared/hooks";
import { useAdminStore } from "@green-goods/shared/stores";
import { cn } from "@green-goods/shared/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  type Control,
  type FieldError,
  type FieldErrorsImpl,
  type Path,
  type SubmitErrorHandler,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { toastService } from "@green-goods/shared";
import { useAccount } from "wagmi";
import { z } from "zod";

const EAS_EXPLORER_URL = "https://base-sepolia.easscan.org";
const CAPITALS_HINT =
  "Choose the forms of capital touched by this assessment (eg. natural, social, financial).";

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
  capitals: stringListSchema,
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

const createAssessmentSchema = baseAssessmentSchema.superRefine((data, ctx) => {
  if (data.capitals.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one capital",
      path: ["capitals"],
    });
  }

  const startTimestamp = new Date(data.startDate).getTime();
  if (Number.isNaN(startTimestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date is invalid",
      path: ["startDate"],
    });
  }

  const endTimestamp = new Date(data.endDate).getTime();
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
  metrics: string; // Will be parsed to Record<string, unknown> before submission
};

type StepId = "overview" | "timeline" | "evidence" | "review";

interface StepConfig {
  id: StepId;
  title: string;
  description: string;
  fields: (keyof CreateAssessmentFormValues)[];
}

interface CreateAssessmentModalProps {
  gardenId: string;
  isOpen: boolean;
  onClose: () => void;
}

const stepConfigs: StepConfig[] = [
  {
    id: "overview",
    title: "Overview",
    description: "Title, type, description, and capitals",
    fields: ["title", "assessmentType", "description", "capitals"],
  },
  {
    id: "timeline",
    title: "Timeline & location",
    description: "Dates, location, and tags",
    fields: ["startDate", "endDate", "location", "tags"],
  },
  {
    id: "evidence",
    title: "Metrics & evidence",
    description: "Metrics JSON, media, and references",
    fields: ["metrics", "reportDocuments", "impactAttestations"],
  },
  {
    id: "review",
    title: "Review",
    description: "Confirm details before submitting",
    fields: [],
  },
];

export function CreateAssessmentModal({ isOpen, onClose, gardenId }: CreateAssessmentModalProps) {
  const {
    state,
    startCreation,
    submitCreation,
    retry,
    reset: resetWorkflow,
    canRetry,
  } = useCreateAssessmentWorkflow();
  const { lastAttestationId, setLastAttestationId } = useAdminStore();
  const { address } = useAccount();

  const defaultValuesRef = useRef<CreateAssessmentForm>(createDefaultAssessmentForm());
  const lastValuesRef = useRef<CreateAssessmentForm>(defaultValuesRef.current);
  const evidenceCacheRef = useRef<File[]>([]);
  const shouldPersistOnCloseRef = useRef(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset: resetForm,
    trigger,
    getValues,
    setValue,
  } = useForm<CreateAssessmentForm>({
    // @ts-expect-error - Complex Zod schema type incompatibility with react-hook-form
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: defaultValuesRef.current,
    mode: "onChange",
    shouldUnregister: false,
  });

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const isSubmitting = state.matches("submitting");
  const hasError = state.matches("error");
  const isSuccess = state.matches("success");
  const attestationId = state.context.txHash ?? lastAttestationId ?? undefined;

  const metricsValue = useWatch({ control, name: "metrics" });
  const summaryValues = useWatch({ control });

  const metricsPreview = useMemo(() => {
    if (!metricsValue) return null;
    try {
      return JSON.parse(metricsValue);
    } catch {
      return null;
    }
  }, [metricsValue]);

  useEffect(() => {
    if (isOpen) {
      resetForm(lastValuesRef.current);
      setEvidenceFiles(evidenceCacheRef.current);
    } else {
      if (shouldPersistOnCloseRef.current) {
        lastValuesRef.current = {
          ...getValues(),
          evidenceMedia: evidenceFiles,
        };
        evidenceCacheRef.current = evidenceFiles;
      } else {
        lastValuesRef.current = defaultValuesRef.current;
        evidenceCacheRef.current = [];
        setCurrentStep(0);
        shouldPersistOnCloseRef.current = true;
      }
    }
  }, [isOpen, getValues, resetForm, evidenceFiles]);

  useEffect(() => {
    setValue("evidenceMedia", evidenceFiles as any, { shouldDirty: true });
  }, [evidenceFiles, setValue]);

  useEffect(() => {
    if (isOpen && lastAttestationId) {
      setLastAttestationId(null);
    }
  }, [isOpen, lastAttestationId, setLastAttestationId]);

  useEffect(() => {
    if (isOpen) {
      resetWorkflow();
    }
  }, [isOpen, resetWorkflow]);

  const onValid = async (formData: CreateAssessmentForm) => {
    try {
      setSubmittedTitle(formData.title);
      if (!address) {
        toastService.error({
          title: "Wallet required",
          message: "Please connect your wallet before submitting an assessment.",
          context: "assessment submission",
          suppressLogging: true,
        });
        return;
      }

      if (!gardenId) {
        toastService.error({
          title: "Select a garden",
          message: "Choose a garden to link this assessment.",
          context: "assessment submission",
          suppressLogging: true,
        });
        return;
      }

      if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
        toastService.error({
          title: "Wallet provider missing",
          message: "Open MetaMask or another Web3 wallet, then try again.",
          context: "assessment submission",
        });
        return;
      }

      // Parse metrics from string to object
      let metricsObj: Record<string, unknown> = {};
      try {
        metricsObj = JSON.parse(formData.metrics.trim() || "{}");
      } catch (error) {
        console.error("Invalid JSON in metrics field", error);
        toastService.error({
          title: "Invalid metrics JSON",
          message: "Check the metrics format and try again.",
          context: "assessment submission",
          error,
        });
        return;
      }

      const payload = {
        ...formData,
        metrics: metricsObj,
        capitals: formData.capitals.map((capital) => capital.trim()),
        reportDocuments: formData.reportDocuments.map((doc) => doc.trim()),
        impactAttestations: formData.impactAttestations.map((uid) => uid.trim()),
        tags: formData.tags.map((tag) => tag.trim()),
        location: formData.location.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        assessmentType: formData.assessmentType.trim(),
        evidenceMedia: evidenceFiles,
        gardenId,
        startDate: Number(new Date(formData.startDate).getTime() / 1000),
        endDate: Number(new Date(formData.endDate).getTime() / 1000),
      };

      startCreation(payload as any);
      const uid = await submitCreation();
      setLastAttestationId(uid);
      toastService.success({
        title: "Assessment submitted",
        message: "We'll post it as soon as it's confirmed.",
        context: "assessment submission",
        suppressLogging: true,
      });
      setCurrentStep(0);
    } catch (error) {
      toastService.error({
        title: "Submission failed",
        message: "Something went wrong. Please try again.",
        context: "assessment submission",
        error,
      });
      console.error("Assessment submission error:", error);
    }
  };

  const onInvalid: SubmitErrorHandler<CreateAssessmentForm> = () => {
    toastService.error({
      title: "Incomplete form",
      message: "Check the highlighted fields and try again.",
      context: "assessment submission",
      suppressLogging: true,
    });
  };

  const handleFormSubmit = handleSubmit(onValid, onInvalid);

  const handleNextStep = async () => {
    const step = stepConfigs[currentStep];
    if (!step) return;
    const valid = await trigger(step.fields as any, { shouldFocus: true });
    if (!valid) {
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const shouldShowReview = stepConfigs[currentStep]?.id === "review";

  const handleEvidenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) {
      return;
    }
    setEvidenceFiles((prev) => [...prev, ...Array.from(event.target.files ?? [])]);
    event.target.value = "";
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleCancel = () => {
    shouldPersistOnCloseRef.current = false;
    setLastAttestationId(null);
    resetWorkflow();
    lastValuesRef.current = defaultValuesRef.current;
    evidenceCacheRef.current = [];
    setEvidenceFiles([]);
    setCurrentStep(0);
    resetForm(defaultValuesRef.current);
    onClose();
  };

  const handleDismiss = () => {
    shouldPersistOnCloseRef.current = true;
    lastValuesRef.current = {
      ...getValues(),
      evidenceMedia: evidenceFiles,
    };
    evidenceCacheRef.current = evidenceFiles;
    onClose();
  };

  const handleCreateAnother = () => {
    setLastAttestationId(null);
    resetWorkflow();
    resetForm(createDefaultAssessmentForm());
    setEvidenceFiles([]);
  };

  const metricsSummary = useMemo(() => {
    if (!summaryValues?.metrics) return null;
    try {
      return JSON.parse(summaryValues.metrics);
    } catch {
      return null;
    }
  }, [summaryValues?.metrics]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-4 py-10 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className={cn(
          "fixed inset-0 bg-black/30 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={handleDismiss}
        aria-label="Dismiss create assessment modal"
      />
      <div
        className={cn(
          "relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition-all dark:border-gray-700 dark:bg-gray-900",
          "max-h-[calc(100vh-80px)]",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900/80">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Record a garden assessment
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Capture the latest impact data, supporting evidence, and references for this garden.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close create assessment modal"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        {stepConfigs.length > 0 && !isSuccess && (
          <ol className="flex flex-wrap gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4 text-sm dark:border-gray-700 dark:bg-gray-900/60">
            {stepConfigs.map((step, index) => {
              const completed = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={step.id} className="flex min-w-[200px] flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium",
                      completed &&
                        "border-green-600 bg-green-100 text-green-700 dark:border-green-500 dark:bg-green-500/20 dark:text-green-300",
                      active &&
                        !completed &&
                        "border-green-600 bg-white text-green-700 dark:border-green-500 dark:bg-gray-900 dark:text-green-300",
                      !completed &&
                        !active &&
                        "border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500"
                    )}
                  >
                    {completed ? <RiCheckboxCircleLine className="h-4 w-4" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {step.title}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {step.description}
                    </p>
                  </div>
                  {index < stepConfigs.length - 1 && (
                    <span className="ml-auto hidden h-px flex-1 bg-gray-200 dark:bg-gray-700 lg:flex" />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {hasError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                <RiErrorWarningLine className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-200">
                    We could not submit the assessment
                  </p>
                  <p className="mt-1 text-red-600 dark:text-red-200/80">
                    {state.context.error ?? "Please review the details and try again."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={retry}
                      disabled={!canRetry || isSubmitting}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/60 dark:text-red-200 dark:hover:bg-red-500/20"
                    >
                      Retry submission
                    </button>
                    <button
                      onClick={() => resetWorkflow()}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Edit details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isSuccess ? (
              <div className="space-y-6 py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-500/20 dark:text-green-300">
                  <RiCheckboxCircleLine className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Assessment attestation submitted
                  </h3>
                  {submittedTitle ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{submittedTitle}</span> is now recorded
                      on-chain.
                    </p>
                  ) : null}
                  {attestationId ? (
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      UID: {attestationId}
                    </p>
                  ) : null}
                  {attestationId && (
                    <a
                      href={`${EAS_EXPLORER_URL}/attestation/view/${attestationId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center text-sm font-medium text-green-600 underline decoration-green-200 underline-offset-4 transition hover:text-green-700 dark:text-green-300 dark:decoration-green-500/40 dark:hover:text-green-200"
                    >
                      View on EAS Explorer
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleCreateAnother}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400"
                  >
                    Record another assessment
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-8">
                {stepConfigs[currentStep]?.id === "overview" && (
                  <Section
                    title="Assessment overview"
                    description="Add a clear title, type, and description to help operators understand the scope of this assessment."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledField
                        label="Title"
                        required
                        error={errors.title?.message}
                        helpText="Summarise this assessment in a few words."
                      >
                        <input
                          type="text"
                          disabled={isSubmitting}
                          className={inputClassName(errors.title)}
                          {...register("title")}
                        />
                      </LabeledField>
                      <LabeledField
                        label="Assessment type"
                        required
                        error={errors.assessmentType?.message}
                        helpText="For example: remote sensing, on-site visit, community report."
                      >
                        <input
                          type="text"
                          disabled={isSubmitting}
                          className={inputClassName(errors.assessmentType)}
                          {...register("assessmentType")}
                        />
                      </LabeledField>
                    </div>
                    <LabeledField
                      label="Description"
                      required
                      error={errors.description?.message}
                      helpText="Provide context, goals, or key learnings from this assessment."
                    >
                      <textarea
                        rows={4}
                        disabled={isSubmitting}
                        className={textareaClassName(errors.description)}
                        {...register("description")}
                      />
                    </LabeledField>
                    <ArrayInput
                      control={control as any}
                      name="capitals"
                      label="Forms of capital"
                      placeholder="e.g. natural capital"
                      helper={CAPITALS_HINT}
                      emptyHint="No capitals selected yet."
                      disabled={isSubmitting}
                      error={extractErrorMessage(errors.capitals as any)}
                      addLabel="Add capital"
                    />
                  </Section>
                )}

                {stepConfigs[currentStep]?.id === "timeline" && (
                  <Section
                    title="Timeline & location"
                    description="Share when this assessment took place and where the observations were recorded."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledField label="Start date" required error={errors.startDate?.message}>
                        <input
                          type="date"
                          disabled={isSubmitting}
                          className={inputClassName(errors.startDate)}
                          {...register("startDate")}
                        />
                      </LabeledField>
                      <LabeledField label="End date" required error={errors.endDate?.message}>
                        <input
                          type="date"
                          disabled={isSubmitting}
                          className={inputClassName(errors.endDate)}
                          {...register("endDate")}
                        />
                      </LabeledField>
                    </div>
                    <LabeledField label="Location" required error={errors.location?.message}>
                      <input
                        type="text"
                        disabled={isSubmitting}
                        className={inputClassName(errors.location)}
                        placeholder="City, coordinates, or region"
                        {...register("location")}
                      />
                    </LabeledField>
                    <ArrayInput
                      control={control as any}
                      name="tags"
                      label="Tags"
                      placeholder="water-quality"
                      helper="Add labels to group similar assessments."
                      emptyHint="No tags added."
                      disabled={isSubmitting}
                      error={extractErrorMessage(errors.tags as any)}
                      addLabel="Add tag"
                    />
                  </Section>
                )}

                {stepConfigs[currentStep]?.id === "evidence" && (
                  <Section
                    title="Metrics, evidence & references"
                    description="Upload metrics, media, supporting documents, and related impact attestations."
                  >
                    <LabeledField label="Metrics JSON" required error={errors.metrics?.message}>
                      <textarea
                        rows={6}
                        disabled={isSubmitting}
                        className={textareaClassName(errors.metrics)}
                        placeholder='{\n  "indicators": []\n}'
                        {...register("metrics")}
                      />
                    </LabeledField>
                    {metricsPreview ? (
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-300">
                        <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">
                          Metrics preview
                        </p>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-gray-700 dark:text-gray-200">
                          {JSON.stringify(metricsPreview, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          Evidence media
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          Upload photos, videos, or supporting files. They will be pinned privately
                          to IPFS.
                        </span>
                        <input
                          type="file"
                          multiple
                          onChange={handleEvidenceChange}
                          disabled={isSubmitting}
                          className={cn(
                            "mt-1 w-full cursor-pointer rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:border-green-500 file:mr-3 file:rounded-md file:border-0 file:bg-green-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:border-green-500/80 dark:file:bg-green-500"
                          )}
                        />
                      </label>
                      {evidenceFiles.length > 0 ? (
                        <ul className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-200">
                          {evidenceFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 shadow-sm dark:bg-gray-900"
                            >
                              <span className="truncate text-gray-700 dark:text-gray-200">
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeEvidenceFile(index)}
                                className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20"
                                aria-label={`Remove ${file.name}`}
                              >
                                <RiDeleteBinLine className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          No evidence files selected yet.
                        </p>
                      )}
                    </div>
                    <ArrayInput
                      control={control as any}
                      name="reportDocuments"
                      label="Report documents"
                      placeholder="https://..."
                      helper="Paste URLs or IPFS CIDs for supporting documents."
                      emptyHint="No report documents added."
                      disabled={isSubmitting}
                      error={extractErrorMessage(errors.reportDocuments as any)}
                      addLabel="Add document"
                    />
                    <ArrayInput
                      control={control as any}
                      name="impactAttestations"
                      label="Related impact attestations"
                      placeholder="0x..."
                      helper="Reference related EAS attestations using their 32-byte UID."
                      emptyHint="No attestation references added."
                      disabled={isSubmitting}
                      error={extractErrorMessage(errors.impactAttestations as any)}
                      addLabel="Add attestation"
                      transformValue={(value) => value.toLowerCase()}
                    />
                  </Section>
                )}

                {shouldShowReview && (
                  <Section
                    title="Review assessment"
                    description="Confirm the details below before submitting this assessment on-chain."
                  >
                    <div className="space-y-4 text-sm text-gray-700">
                      <ReviewRow label="Title" value={summaryValues?.title} />
                      <ReviewRow label="Assessment type" value={summaryValues?.assessmentType} />
                      <ReviewRow label="Description" value={summaryValues?.description} multiline />
                      <ReviewRow
                        label="Capitals"
                        value={
                          summaryValues?.capitals?.length
                            ? summaryValues.capitals.join(", ")
                            : "Not provided"
                        }
                      />
                      <ReviewRow
                        label="Date range"
                        value={formatDateRange(summaryValues?.startDate, summaryValues?.endDate)}
                      />
                      <ReviewRow
                        label="Location"
                        value={summaryValues?.location || "Not provided"}
                      />
                      <ReviewRow
                        label="Tags"
                        value={
                          summaryValues?.tags?.length
                            ? summaryValues.tags.join(", ")
                            : "Not provided"
                        }
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                          Metrics
                        </p>
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-300">
                          {metricsSummary ? (
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-gray-700 dark:text-gray-200">
                              {JSON.stringify(metricsSummary, null, 2)}
                            </pre>
                          ) : (
                            <span>No metrics provided</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                          Evidence media
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          {evidenceFiles.length
                            ? evidenceFiles.map((file, index) => (
                                <li key={`${file.name}-${index}`} className="">
                                  {file.name}
                                </li>
                              ))
                            : "No files attached"}
                        </ul>
                      </div>
                      <ReviewRow
                        label="Report documents"
                        value={
                          summaryValues?.reportDocuments?.length
                            ? summaryValues.reportDocuments.join(", ")
                            : "No documents"
                        }
                      />
                      <ReviewRow
                        label="Impact attestations"
                        value={
                          summaryValues?.impactAttestations?.length
                            ? summaryValues.impactAttestations.join(", ")
                            : "No attestations"
                        }
                      />
                    </div>
                  </Section>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {currentStep > 0 && (
                      <button
                        type="button"
                        onClick={handlePreviousStep}
                        className="flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Back
                      </button>
                    )}
                    {shouldShowReview ? (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-500 dark:hover:bg-green-400"
                      >
                        {isSubmitting ? (
                          <>
                            <RiLoader4Line className="h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit assessment"
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LabeledFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
}

function LabeledField({ label, required, error, helpText, children }: LabeledFieldProps) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-gray-700 dark:text-gray-200">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {helpText ? (
        <span className="block text-xs text-gray-500 dark:text-gray-400">{helpText}</span>
      ) : null}
      {children}
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}

const inputClassName = (error?: FieldError) =>
  cn(
    "mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
    error &&
      "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
  );

const textareaClassName = (error?: FieldError) =>
  cn(
    "mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
    error &&
      "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
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

function ArrayInput<TName extends Path<CreateAssessmentFormValues>>({
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
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
        {helper ? (
          <span className="block text-xs text-gray-500 dark:text-gray-400">{helper}</span>
        ) : null}
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
            "flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
            error &&
              "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
          )}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || inputValue.trim().length === 0}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RiAddLine className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
      <div className="space-y-2">
        {fields.length === 0
          ? emptyHint && <p className="text-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>
          : fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-200"
              >
                <span className="break-all">{values[index] ?? ""}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-500/20"
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

function extractErrorMessage(error?: FieldError | FieldErrorsImpl<any>): string | undefined {
  if (!error) {
    return undefined;
  }

  const message = (error as FieldError).message ?? (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function createDefaultAssessmentForm(): CreateAssessmentForm {
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ReviewRow({
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
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm text-gray-700 dark:text-gray-300",
          multiline ? "whitespace-pre-wrap break-words" : "truncate"
        )}
      >
        {value && value.trim().length > 0 ? value : "Not provided"}
      </p>
    </div>
  );
}

function formatDateRange(start?: string | number | null, end?: string | number | null) {
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
