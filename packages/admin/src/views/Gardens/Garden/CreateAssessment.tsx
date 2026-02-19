import {
  type Address,
  ConfirmDialog,
  ErrorBoundary,
  type CreateAssessmentForm as WorkflowAssessmentForm,
  toastService,
  useCreateAssessmentWorkflow,
  useGardenDomains,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiErrorWarningLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { DomainActionStep } from "@/components/Assessment/CreateAssessmentSteps/DomainActionStep";
import { SdgHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/SdgHarvestStep";
import {
  type CreateAssessmentForm,
  STEP_FIELDS,
  createAssessmentSchema,
  createDefaultAssessmentForm,
} from "@/components/Assessment/CreateAssessmentSteps/shared";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";

const stepConfigs: Step[] = [
  {
    id: "strategy",
    title: "Strategy Kernel",
    description: "Diagnosis, outcomes, and complexity",
  },
  {
    id: "domain",
    title: "Domain & Actions",
    description: "Domain selection and coherent actions",
  },
  {
    id: "sdgHarvest",
    title: "SDG & Harvest",
    description: "SDG alignment and reporting period",
  },
];

function toInputDate(value: string | number | null | undefined): string {
  if (!value) return "";

  let timestampMs: number;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return "";
    timestampMs = value > 10_000_000_000 ? value : value * 1000;
  } else {
    const parsed = new Date(value).getTime();
    if (Number.isNaN(parsed)) return "";
    timestampMs = parsed;
  }

  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "";
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function toUnixSeconds(value: string): number {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.floor(timestamp / 1000);
}

function toAssessmentFormDraft(
  draft: WorkflowAssessmentForm,
  fallback: CreateAssessmentForm
): CreateAssessmentForm {
  const metrics =
    typeof draft.metrics === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(draft.metrics);
            return typeof parsed === "object" && parsed !== null
              ? (parsed as Record<string, unknown>)
              : {};
          } catch {
            return {};
          }
        })()
      : ((draft.metrics as Record<string, unknown> | null) ?? {});

  const smartOutcomes = Array.isArray(metrics.smartOutcomes)
    ? metrics.smartOutcomes.filter(
        (item): item is { description: string; metric: string; target: number } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { description?: unknown }).description === "string" &&
          typeof (item as { metric?: unknown }).metric === "string" &&
          typeof (item as { target?: unknown }).target === "number"
      )
    : [];

  return {
    ...fallback,
    title: draft.title ?? fallback.title,
    description: draft.description ?? fallback.description,
    location: draft.location ?? fallback.location,
    diagnosis: typeof metrics.diagnosis === "string" ? metrics.diagnosis : fallback.diagnosis,
    smartOutcomes: smartOutcomes.length > 0 ? smartOutcomes : fallback.smartOutcomes,
    cynefinPhase:
      typeof metrics.cynefinPhase === "number" ? metrics.cynefinPhase : fallback.cynefinPhase,
    domain: typeof metrics.domain === "number" ? metrics.domain : fallback.domain,
    selectedActionUIDs: Array.isArray(metrics.selectedActionUIDs)
      ? metrics.selectedActionUIDs.filter((item): item is string => typeof item === "string")
      : fallback.selectedActionUIDs,
    sdgTargets: Array.isArray(metrics.sdgTargets)
      ? metrics.sdgTargets.filter((item): item is number => typeof item === "number")
      : fallback.sdgTargets,
    reportingPeriodStart: toInputDate(draft.startDate),
    reportingPeriodEnd: toInputDate(draft.endDate),
    attachments: draft.evidenceMedia ?? [],
  };
}

export default function CreateAssessment() {
  const { formatMessage } = useIntl();
  const { id: gardenId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const [currentStep, setCurrentStep] = useState(0);
  const [showGasConfirm, setShowGasConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<WorkflowAssessmentForm | null>(null);

  const { data: gardenDomainMask } = useGardenDomains(gardenId);
  const normalizedGardenDomainMask =
    typeof gardenDomainMask === "bigint"
      ? Number(gardenDomainMask)
      : typeof gardenDomainMask === "number"
        ? gardenDomainMask
        : undefined;

  const {
    state,
    startCreation,
    submitCreation,
    retry,
    reset: resetWorkflow,
    canRetry,
    draft,
  } = useCreateAssessmentWorkflow({ gardenId });
  const { loadDraft, saveDraft, draftKey } = draft;
  const draftPersistenceWarningShownRef = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset: resetForm,
    trigger,
    watch,
  } = useForm<CreateAssessmentForm>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: createDefaultAssessmentForm(),
    mode: "onChange",
    shouldUnregister: false,
  });

  const buildWorkflowPayload = useCallback(
    (formData: CreateAssessmentForm): WorkflowAssessmentForm | null => {
      if (!gardenId) return null;

      return {
        title: formData.title.trim(),
        description: formData.description.trim(),
        assessmentType: `domain-${formData.domain}`,
        capitals: [],
        metrics: {
          diagnosis: formData.diagnosis,
          smartOutcomes: formData.smartOutcomes,
          cynefinPhase: formData.cynefinPhase,
          domain: formData.domain,
          selectedActionUIDs: formData.selectedActionUIDs,
          sdgTargets: formData.sdgTargets,
        },
        evidenceMedia: formData.attachments ?? [],
        reportDocuments: [],
        impactAttestations: [],
        startDate: toUnixSeconds(formData.reportingPeriodStart),
        endDate: toUnixSeconds(formData.reportingPeriodEnd),
        location: formData.location.trim(),
        tags: formData.sdgTargets.map((id) => `sdg-${id}`),
        gardenId: gardenId as Address,
      };
    },
    [gardenId]
  );

  const isSubmitting = state.matches("submitting");
  const hasError = state.matches("error");
  const isSuccess = state.matches("success");

  // Load draft on mount
  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      const savedDraft = await loadDraft();
      if (!savedDraft || cancelled) return;
      resetForm(toAssessmentFormDraft(savedDraft, createDefaultAssessmentForm()));
    };

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [loadDraft, resetForm]);

  // Save draft on form changes with a small debounce to reduce IDB writes
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const subscription = watch((value) => {
      const payload = buildWorkflowPayload({
        ...createDefaultAssessmentForm(),
        ...(value as Partial<CreateAssessmentForm>),
      });
      if (!payload) return;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void (async () => {
          const savedDraft = await saveDraft(payload);
          if (savedDraft) {
            draftPersistenceWarningShownRef.current = false;
            return;
          }

          if (!draftKey || draftPersistenceWarningShownRef.current) return;
          draftPersistenceWarningShownRef.current = true;
          toastService.info({
            title: formatMessage({
              id: "app.assessment.draftPersistence.saveFailed.title",
              defaultMessage: "Draft backup unavailable",
            }),
            message: formatMessage({
              id: "app.assessment.draftPersistence.saveFailed.message",
              defaultMessage:
                "Assessment submission will continue, but your draft could not be saved.",
            }),
            context: "assessment draft",
            suppressLogging: true,
          });
        })();
      }, 600);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [watch, buildWorkflowPayload, saveDraft, draftKey, formatMessage]);

  // Navigate on success
  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: formatMessage({
          id: "app.assessment.submitted",
          defaultMessage: "Assessment submitted",
        }),
        message: formatMessage({
          id: "app.assessment.submittedMessage",
          defaultMessage: "Your assessment has been recorded on-chain",
        }),
        context: "assessment submission",
        suppressLogging: true,
      });
      navigate(`/gardens/${gardenId}/assessments`);
    }
  }, [isSuccess, navigate, gardenId, formatMessage]);

  useEffect(() => {
    resetWorkflow();
  }, [resetWorkflow]);

  const onValid = async (formData: CreateAssessmentForm) => {
    try {
      if (!address) {
        toastService.error({
          title: formatMessage({
            id: "app.assessment.walletRequired",
            defaultMessage: "Wallet required",
          }),
          message: formatMessage({
            id: "app.assessment.walletRequiredMessage",
            defaultMessage: "Please connect your wallet before submitting an assessment.",
          }),
          context: "assessment submission",
          suppressLogging: true,
        });
        return;
      }

      const payload = buildWorkflowPayload(formData);
      if (!payload) {
        toastService.error({
          title: formatMessage({
            id: "app.assessment.selectGarden",
            defaultMessage: "Select a garden",
          }),
          message: formatMessage({
            id: "app.assessment.selectGardenMessage",
            defaultMessage: "Choose a garden to link this assessment.",
          }),
          context: "assessment submission",
          suppressLogging: true,
        });
        return;
      }

      setPendingPayload(payload);
      setShowGasConfirm(true);
    } catch (error) {
      toastService.error({
        title: formatMessage({
          id: "app.assessment.submissionFailed",
          defaultMessage: "Submission failed",
        }),
        message: formatMessage({
          id: "app.assessment.submissionFailedMessage",
          defaultMessage: "Something went wrong. Please try again.",
        }),
        context: "assessment submission",
        error,
      });
    }
  };

  const handleNextStep = async () => {
    const step = stepConfigs[currentStep];
    if (!step) return;

    const fieldMap: Record<string, readonly (keyof CreateAssessmentForm)[]> = STEP_FIELDS;
    const fields = fieldMap[step.id];
    if (fields) {
      const valid = await trigger([...fields], { shouldFocus: true });
      if (!valid) return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCancel = () => {
    navigate(`/gardens/${gardenId}/assessments`);
  };

  const handleFormSubmit = handleSubmit(onValid, () => {
    toastService.error({
      title: formatMessage({
        id: "app.assessment.incompleteForm",
        defaultMessage: "Incomplete form",
      }),
      message: formatMessage({
        id: "app.assessment.incompleteFormMessage",
        defaultMessage: "Check the highlighted fields and try again.",
      }),
      context: "assessment submission",
      suppressLogging: true,
    });
  });

  const handleConfirmAssessment = () => {
    if (pendingPayload) {
      const started = startCreation(pendingPayload);
      if (started) {
        submitCreation();
      }
    }
    setShowGasConfirm(false);
    setPendingPayload(null);
  };

  const handleCancelAssessment = () => {
    setShowGasConfirm(false);
    setPendingPayload(null);
  };

  // Check if current step fields have errors
  const isCurrentStepValid = () => {
    const step = stepConfigs[currentStep];
    if (!step) return true;

    const fieldMap: Record<string, readonly (keyof CreateAssessmentForm)[]> = STEP_FIELDS;
    const fields = fieldMap[step.id];
    if (!fields) return true;

    return fields.every((field) => !errors[field]);
  };

  const nextDisabled = !isCurrentStepValid();

  return (
    <ErrorBoundary context="CreateAssessment.Wizard">
      {hasError && (
        <div className="fixed inset-x-0 top-[120px] z-20 mx-auto max-w-4xl px-4 sm:px-6">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-error-light bg-error-lighter p-4 text-sm text-error-dark shadow-lg"
          >
            <RiErrorWarningLine className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-error-dark">
                {formatMessage({
                  id: "app.assessment.couldNotSubmit",
                  defaultMessage: "We could not submit the assessment",
                })}
              </p>
              <p className="mt-1 text-error-dark/80">
                {state.context.error ??
                  formatMessage({
                    id: "app.assessment.reviewAndRetry",
                    defaultMessage: "Please review the details and try again.",
                  })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={retry}
                  disabled={!canRetry || isSubmitting}
                  className="rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formatMessage({
                    id: "app.assessment.retrySubmission",
                    defaultMessage: "Retry submission",
                  })}
                </button>
                <button
                  onClick={() => resetWorkflow()}
                  className="rounded-md border border-stroke-soft px-3 py-1.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                >
                  {formatMessage({
                    id: "app.assessment.editDetails",
                    defaultMessage: "Edit details",
                  })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleFormSubmit}>
        <FormWizard
          steps={stepConfigs}
          currentStep={currentStep}
          onNext={handleNextStep}
          onBack={handlePreviousStep}
          onCancel={handleCancel}
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
          nextDisabled={nextDisabled}
          nextLabel={formatMessage({ id: "app.assessment.continue", defaultMessage: "Continue" })}
          submitLabel={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
        >
          {stepConfigs[currentStep]?.id === "strategy" && (
            <StrategyKernelStep
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
            />
          )}
          {stepConfigs[currentStep]?.id === "domain" && (
            <DomainActionStep
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
              gardenDomainMask={normalizedGardenDomainMask}
            />
          )}
          {stepConfigs[currentStep]?.id === "sdgHarvest" && (
            <SdgHarvestStep
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
            />
          )}
        </FormWizard>
      </form>
      <ConfirmDialog
        isOpen={showGasConfirm}
        onClose={handleCancelAssessment}
        onConfirm={handleConfirmAssessment}
        title={formatMessage({
          id: "app.assessment.confirmSubmit.title",
          defaultMessage: "Submit assessment?",
        })}
        description={formatMessage({
          id: "app.assessment.confirmSubmit.description",
          defaultMessage:
            "This will create an on-chain attestation which costs gas. This action cannot be undone.",
        })}
      />
    </ErrorBoundary>
  );
}
