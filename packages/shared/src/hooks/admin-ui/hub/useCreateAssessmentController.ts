import {
  type Address,
  adminRoutes,
  assessmentStepFields,
  compareAddresses,
  type CreateAssessmentFormData,
  type Step,
  toastService,
  useAdminGardenContext,
  useCreateAssessmentForm,
  useCreateAssessmentStore,
  useCreateAssessmentWorkflow,
  useFormWizardStepValidation,
  useGardenDomains,
  useGardenPermissions,
  useGardens,
  useTxErrorMessages,
  type CreateAssessmentForm as WorkflowAssessmentForm,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { useShallow } from "zustand/react/shallow";

function useCreateAssessmentStepConfigs(): Step[] {
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

export function useCreateAssessmentController() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const stepConfigs = useCreateAssessmentStepConfigs();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { activeGarden, activeGardenId } = useAdminGardenContext();
  const { data: gardens = [] } = useGardens();
  const permissions = useGardenPermissions();
  const gardenId = activeGardenId;
  const garden = useMemo(() => {
    const indexedGarden = gardens.find((item) => compareAddresses(item.id, gardenId));
    return indexedGarden ?? activeGarden ?? undefined;
  }, [activeGarden, gardens, gardenId]);
  const gardenRouteContext = useMemo(() => ({ gardenId: garden?.id }), [garden?.id]);
  const canReview = garden ? permissions.canReviewGarden(garden) : false;

  const form = useCreateAssessmentStore(useShallow((state) => state.form));
  const currentStep = useCreateAssessmentStore((state) => state.currentStep);
  const goToStep = useCreateAssessmentStore((state) => state.goToStep);
  const setField = useCreateAssessmentStore((state) => state.setField);
  const nextStep = useCreateAssessmentStore((state) => state.nextStep);
  const previousStep = useCreateAssessmentStore((state) => state.previousStep);
  const resetStore = useCreateAssessmentStore((state) => state.reset);
  const { trigger, reset: resetValidationForm } = useCreateAssessmentForm();
  const stepValidation = useFormWizardStepValidation({
    currentStep,
    steps: stepConfigs,
    stepFields: assessmentStepFields,
    trigger: (fields, options) => trigger(fields as Parameters<typeof trigger>[0], options),
    onValidNext: nextStep,
    onBack: previousStep,
    clearValidationAfterValidNext: true,
  });

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
  const { loadDraft, saveDraft, clearDraft, draftKey } = draft;
  const draftPersistenceWarningShownRef = useRef(false);

  useEffect(() => {
    resetValidationForm(form);
  }, [form, resetValidationForm]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    const restoreDraft = async () => {
      const savedDraft = await loadDraft();
      if (!savedDraft || cancelled) return;

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

  const prevFormRef = useRef(form);
  useEffect(() => {
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
  // Dirty = the operator has progressed past the first step or entered any
  // meaningful field. Gates the confirm-before-discard on close (useDirtyClose).
  // Suppressed while submitting/succeeded so the close-to-Hub flow isn't blocked.
  const isDirty = useMemo(() => {
    if (isSubmitting || isSuccess) return false;
    if (currentStep > 0) return true;
    return (
      form.title.trim().length > 0 ||
      form.description.trim().length > 0 ||
      form.location.trim().length > 0 ||
      form.diagnosis.trim().length > 0 ||
      form.smartOutcomes.length > 0 ||
      form.selectedActionUIDs.length > 0 ||
      form.sdgTargets.length > 0
    );
  }, [currentStep, form, isSubmitting, isSuccess]);
  const txError = useTxErrorMessages(state.context.error);

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
      navigate(adminRoutes.gardenImpact({ ...gardenRouteContext, section: "assessments" }));
    }
  }, [formatMessage, gardenRouteContext, isSuccess, navigate, resetStore]);

  const handleCancel = () => {
    // Return to the Hub the flow was launched from (parity with Submit Work),
    // not the garden impact view — closing a Hub create-flow must not jump tabs.
    navigate(adminRoutes.hub(gardenRouteContext));
  };

  // Wired to useDirtyClose's onDiscard (parity with useWizardData's
  // onDiscard: reset) — runs only on an explicit confirmed "Discard", not on
  // the plain step-1 Cancel button. Neither the in-memory store nor the
  // auto-saved IndexedDB draft were cleared here before, so the next mount's
  // restoreDraft() effect silently repopulated the "discarded" fields.
  const handleDiscard = () => {
    resetStore();
    void clearDraft();
  };

  const handleSubmit = async () => {
    const isFormValid = await stepValidation.validateAll();
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

  return {
    canRetry,
    canReview,
    currentStep,
    goToStep,
    errorMessage: txError.message,
    errorTitle: txError.title,
    garden,
    gardenRouteContext,
    hubContext: gardenRouteContext,
    handleBack: stepValidation.handleBack,
    handleCancel,
    handleDiscard,
    handleNext: stepValidation.handleNext,
    handleSubmit,
    hasError,
    isDirty,
    isSubmitting,
    normalizedGardenDomainMask,
    resetWorkflow,
    retry,
    showValidation: stepValidation.showValidation,
    stepConfigs,
    txErrorView: txError.view,
  };
}
