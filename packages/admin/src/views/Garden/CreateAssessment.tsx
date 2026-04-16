import {
  type Address,
  Alert,
  adminRoutes,
  assessmentStepFields,
  type CreateAssessmentFormData,
  classifyTxError,
  ErrorBoundary,
  FormWizard,
  isMeaningfulTxErrorMessage,
  type Step,
  TxInlineFeedback,
  toastService,
  useCreateAssessmentForm,
  useCreateAssessmentStore,
  useCreateAssessmentWorkflow,
  useAdminStore,
  useGardenDomains,
  useGardenPermissions,
  useGardens,
  type CreateAssessmentForm as WorkflowAssessmentForm,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { AdminButton } from "@/components/AdminButton";
import { ActionsHarvestStep } from "@/components/Assessment/CreateAssessmentSteps/ActionsHarvestStep";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";
import { PageHeader } from "@/components/Layout/PageHeader";

// Exception to hook boundary: view-specific i18n config, non-exported, single-use
function useStepConfigs(): Step[] {
  const { formatMessage } = useIntl();
  return [
    {
      id: "domainContext",
      title: formatMessage({
        id: "app.admin.assessment.create.stepDomainContext.title",
        defaultMessage: "Domain & Context",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepDomainContext.description",
        defaultMessage: "Domain selection, title, and location",
      }),
    },
    {
      id: "strategy",
      title: formatMessage({
        id: "app.admin.assessment.create.stepStrategy.title",
        defaultMessage: "Strategy Kernel",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepStrategy.description",
        defaultMessage: "Diagnosis, outcomes, and complexity",
      }),
    },
    {
      id: "actionsHarvest",
      title: formatMessage({
        id: "app.admin.assessment.create.stepActionsHarvest.title",
        defaultMessage: "Actions & Harvest",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepActionsHarvest.description",
        defaultMessage: "Select actions and reporting period",
      }),
    },
  ];
}

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

export default function CreateAssessment() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const stepConfigs = useStepConfigs();
  const navigate = useNavigate();
  const { address } = useAccount();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const { data: gardens = [] } = useGardens();
  const permissions = useGardenPermissions();
  const gardenId = selectedGarden?.id ?? null;
  const garden = useMemo(() => gardens.find((item) => item.id === gardenId), [gardens, gardenId]);
  const canReview = garden ? permissions.canReviewGarden(garden) : false;

  // ── Zustand store (source of truth for form data) ──────
  const form = useCreateAssessmentStore(useShallow((state) => state.form));
  const currentStep = useCreateAssessmentStore((state) => state.currentStep);
  const setField = useCreateAssessmentStore((state) => state.setField);
  const nextStep = useCreateAssessmentStore((state) => state.nextStep);
  const previousStep = useCreateAssessmentStore((state) => state.previousStep);
  const resetStore = useCreateAssessmentStore((state) => state.reset);

  // ── RHF form (validation-only layer — just trigger + reset) ──
  const { trigger, reset: resetValidationForm } = useCreateAssessmentForm();

  const [showValidation, setShowValidation] = useState(false);

  const { data: gardenDomainMask } = useGardenDomains(
    (gardenId ?? undefined) as Address | undefined
  );
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
  } = useCreateAssessmentWorkflow({ gardenId: gardenId ?? undefined });
  const { loadDraft, saveDraft, draftKey } = draft;
  const draftPersistenceWarningShownRef = useRef(false);

  // ── Sync Zustand store → RHF validation form ──────────
  // Every store change clears all RHF errors and updates values.
  // This is the key pattern from CreateGarden that prevents stale errors.
  useEffect(() => {
    resetValidationForm(form);
  }, [form, resetValidationForm]);

  // ── Draft restore on mount ─────────────────────────────
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    const restoreDraft = async () => {
      const savedDraft = await loadDraft();
      if (!savedDraft || cancelled) return;

      // Parse draft into form fields and set each in the store
      const metrics =
        typeof savedDraft.metrics === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(savedDraft.metrics);
                return typeof parsed === "object" && parsed !== null
                  ? (parsed as Record<string, unknown>)
                  : {};
              } catch {
                return {};
              }
            })()
          : ((savedDraft.metrics as Record<string, unknown> | null) ?? {});

      if (savedDraft.title) setField("title", savedDraft.title);
      if (savedDraft.description) setField("description", savedDraft.description);
      if (savedDraft.location) setField("location", savedDraft.location);
      if (typeof metrics.diagnosis === "string") setField("diagnosis", metrics.diagnosis);
      if (typeof metrics.cynefinPhase === "number") setField("cynefinPhase", metrics.cynefinPhase);
      if (typeof metrics.domain === "number") setField("domain", metrics.domain);

      if (Array.isArray(metrics.smartOutcomes)) {
        const validOutcomes = metrics.smartOutcomes.filter(
          (item): item is { description: string; metric: string; target: number } =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { description?: unknown }).description === "string" &&
            typeof (item as { metric?: unknown }).metric === "string" &&
            typeof (item as { target?: unknown }).target === "number"
        );
        if (validOutcomes.length > 0) setField("smartOutcomes", validOutcomes);
      }

      if (Array.isArray(metrics.selectedActionUIDs)) {
        const validUIDs = metrics.selectedActionUIDs.filter(
          (item): item is string => typeof item === "string"
        );
        setField("selectedActionUIDs", validUIDs);
      }

      if (Array.isArray(metrics.sdgTargets)) {
        const validTargets = metrics.sdgTargets.filter(
          (item): item is number => typeof item === "number"
        );
        setField("sdgTargets", validTargets);
      }

      const startDate = toInputDate(savedDraft.startDate);
      const endDate = toInputDate(savedDraft.endDate);
      if (startDate) setField("reportingPeriodStart", startDate);
      if (endDate) setField("reportingPeriodEnd", endDate);
    };

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [loadDraft, setField]);

  const buildWorkflowPayload = useCallback(
    (formData: CreateAssessmentFormData): WorkflowAssessmentForm | null => {
      if (!gardenId || !isAddress(gardenId)) return null;

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

  // ── Save draft on store changes ────────────────────────
  const prevFormRef = useRef(form);
  useEffect(() => {
    // Skip the initial render
    if (prevFormRef.current === form) return;
    prevFormRef.current = form;

    const payload = buildWorkflowPayload(form);
    if (!payload) return;

    const timeoutId = setTimeout(() => {
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

    return () => clearTimeout(timeoutId);
  }, [form, buildWorkflowPayload, saveDraft, draftKey, formatMessage]);

  const isSubmitting = state.matches("submitting");
  const hasError = state.matches("error");
  const isSuccess = state.matches("success");
  const txErrorView = useMemo(() => classifyTxError(state.context.error), [state.context.error]);
  const errorTitle = formatMessage({
    id: txErrorView.titleKey,
    defaultMessage:
      txErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const errorMessage =
    txErrorView.kind === "cancelled"
      ? formatMessage({
          id: txErrorView.messageKey,
          defaultMessage: "Transaction was cancelled. Please try again when ready.",
        })
      : isMeaningfulTxErrorMessage(txErrorView.rawMessage)
        ? txErrorView.rawMessage
        : formatMessage({
            id: txErrorView.messageKey,
            defaultMessage: "Please review the details and try again.",
          });

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
      resetStore();
      navigate(adminRoutes.gardenImpact({ section: "assessments" }));
    }
  }, [isSuccess, navigate, gardenId, formatMessage, resetStore]);

  // Reset validation display when step changes
  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  // ── Step validation (Garden pattern: trigger returns boolean) ──
  const handleNext = async () => {
    setShowValidation(true);
    const currentStepId = stepConfigs[currentStep]?.id;
    if (currentStepId) {
      const fields = assessmentStepFields[currentStepId as keyof typeof assessmentStepFields];
      if (fields) {
        const isStepValid = await trigger([...fields], { shouldFocus: true });
        if (!isStepValid) return;
      }
    }
    setShowValidation(false);
    nextStep();
  };

  const handleBack = () => {
    setShowValidation(false);
    previousStep();
  };

  const handleCancel = () => {
    navigate(adminRoutes.gardenImpact({ section: "assessments" }));
  };

  // ── Final submission (validate all fields) ─────────────
  const handleSubmit = async () => {
    setShowValidation(true);
    const isFormValid = await trigger(undefined, { shouldFocus: true });
    if (!isFormValid) {
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
      return;
    }

    const onValid = async () => {
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

      const payload = buildWorkflowPayload(form);
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

      const started = startCreation(payload);
      if (!started) {
        toastService.error({
          title: formatMessage({
            id: "app.assessment.couldNotSubmit",
            defaultMessage: "We could not submit the assessment",
          }),
          message: formatMessage({
            id: "app.assessment.submissionFailedMessage",
            defaultMessage: "Something went wrong. Please try again.",
          }),
          context: "assessment submission",
          suppressLogging: true,
        });
        return;
      }

      submitCreation();
    };

    void onValid();
  };

  if (!garden) {
    return (
      <div className="pb-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <PageHeader
            title={formatMessage({
              id: "app.assessment.submitAssessment",
              defaultMessage: "Submit assessment",
            })}
            description={formatMessage({ id: "app.garden.admin.notFound" })}
            variant="canvas"
            backLink={{
              to: "/garden",
              label: formatMessage({ id: "app.garden.admin.backToGardens" }),
            }}
            sticky
          />
        </div>
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
          </div>
        </div>
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="pb-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <PageHeader
            title={formatMessage({
              id: "app.assessment.submitAssessment",
              defaultMessage: "Submit assessment",
            })}
            description={formatMessage({ id: "app.admin.auth.noPermission" })}
            variant="canvas"
            backLink={{
              to: adminRoutes.garden(),
              label: formatMessage({ id: "app.garden.admin.backToGardens" }),
            }}
            sticky
          />
        </div>
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <Alert variant="warning">{formatMessage({ id: "app.admin.auth.noPermission" })}</Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <PageHeader
          title={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
          description={formatMessage({
            id: "cockpit.assessment.createDescription",
            defaultMessage:
              "Capture the context, strategy kernel, and harvest window for a new assessment.",
          })}
          variant="canvas"
          backLink={{
            to: adminRoutes.hubAssess(),
            label: formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
          }}
          sticky
        />
      </div>
      <ErrorBoundary context="CreateAssessment.Wizard">
        <FormWizard
          steps={stepConfigs}
          currentStep={currentStep}
          onNext={handleNext}
          onBack={handleBack}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          nextLabel={formatMessage({ id: "app.assessment.continue", defaultMessage: "Continue" })}
          submitLabel={formatMessage({
            id: "app.assessment.submitAssessment",
            defaultMessage: "Submit assessment",
          })}
        >
          <TxInlineFeedback
            visible={hasError}
            severity={txErrorView.severity}
            title={errorTitle}
            message={errorMessage}
            reserveClassName="min-h-[8.5rem]"
            className="mb-4"
            action={
              <div className="flex flex-wrap gap-2">
                <AdminButton
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={retry}
                  disabled={!canRetry || isSubmitting}
                >
                  {formatMessage({
                    id: "app.assessment.retrySubmission",
                    defaultMessage: "Retry submission",
                  })}
                </AdminButton>
                <AdminButton type="button" variant="text" size="sm" onClick={() => resetWorkflow()}>
                  {formatMessage({
                    id: "app.assessment.editDetails",
                    defaultMessage: "Edit details",
                  })}
                </AdminButton>
              </div>
            }
          />
          {stepConfigs[currentStep]?.id === "domainContext" && (
            <DomainContextStep
              showValidation={showValidation}
              isSubmitting={isSubmitting}
              gardenDomainMask={normalizedGardenDomainMask}
            />
          )}
          {stepConfigs[currentStep]?.id === "strategy" && (
            <StrategyKernelStep showValidation={showValidation} isSubmitting={isSubmitting} />
          )}
          {stepConfigs[currentStep]?.id === "actionsHarvest" && (
            <ActionsHarvestStep showValidation={showValidation} isSubmitting={isSubmitting} />
          )}
        </FormWizard>
      </ErrorBoundary>
    </div>
  );
}
