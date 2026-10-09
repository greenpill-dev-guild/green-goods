import type { Step } from "../../../components/Form/StepIndicator";
import { toastService } from "../../../components/Toast/toast.service";
import {
  type CreateAssessmentFormState,
  useCreateAssessmentStore,
} from "../../../stores/useCreateAssessmentStore";
import {
  type Address,
  Domain,
  type CreateAssessmentForm as WorkflowAssessmentForm,
} from "../../../types/domain";
import { compareAddresses } from "../../../utils/blockchain/address";
import { expandDomainMask } from "../../../utils/domain";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import {
  assessmentStepFields,
  type CreateAssessmentFormData,
  useCreateAssessmentForm,
} from "../../assessment/useCreateAssessmentForm";
import { useCreateAssessmentWorkflow } from "../../assessment/useCreateAssessmentWorkflow";
import { useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenContext } from "../../garden/useAdminGardenContext";
import { useGardenDomains } from "../../garden/useGardenDomains";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useFormWizardStepValidation } from "../../ui/useFormWizardStepValidation";
import { useTxErrorMessages } from "../../utils/useTxErrorMessages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { isAddress } from "viem";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useShallow } from "zustand/react/shallow";
import { selectAssessmentDirtyState } from "../../../stores/transitions/create-assessment";

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
        defaultMessage: "Challenge & Goals",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepStrategy.description",
        defaultMessage: "The challenge, what you'll measure, and how predictable the work is",
      }),
    },
    {
      id: "actionsHarvest",
      title: formatMessage({
        id: "app.admin.assessment.create.stepActionsHarvest.title",
        defaultMessage: "Actions & Reporting Period",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepActionsHarvest.description",
        defaultMessage: "Select actions and reporting period",
      }),
    },
    {
      id: "review",
      title: formatMessage({
        id: "app.admin.assessment.create.stepReview.title",
        defaultMessage: "Review",
      }),
      description: formatMessage({
        id: "app.admin.assessment.create.stepReview.description",
        defaultMessage: "Check everything before submitting",
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

/** Every domain that exists: what a garden may document before its own domains load. */
const KNOWN_DOMAINS = Object.values(Domain).filter(
  (value): value is Domain => typeof value === "number"
);

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
  const address = usePrimaryAddress();
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
    reset: resetWorkflow,
    draft,
  } = useCreateAssessmentWorkflow({ gardenId: gardenId ?? undefined });
  const { loadDraft, saveDraft, clearDraft, draftKey } = draft;
  const draftPersistenceWarningShownRef = useRef(false);
  const isSubmitting = state.matches("submitting");
  const hasError = state.matches("error");
  const isSent = state.matches("success");

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

  // The form as the workflow reads it. A draft saves before a domain is chosen;
  // a submission never goes without one (buildWorkflowPayload).
  const toAssessmentPayload = useCallback(
    (formData: CreateAssessmentFormData): WorkflowAssessmentForm | null => {
      if (!gardenId || !isAddress(gardenId)) return null;

      return {
        title: formData.title.trim(),
        description: formData.description.trim(),
        assessmentType: formData.domain === null ? "" : `domain-${formData.domain}`,
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

  const buildWorkflowPayload = useCallback(
    (formData: CreateAssessmentFormData): WorkflowAssessmentForm | null =>
      // Validation requires a domain; a missing one is never sent as "domain-null".
      formData.domain === null ? null : toAssessmentPayload(formData),
    [toAssessmentPayload]
  );

  const prevFormRef = useRef(form);
  useEffect(() => {
    if (prevFormRef.current === form) return;
    prevFormRef.current = form;
    // A sent assessment leaves the store empty. That is not an edit to back up,
    // and a copy saved now would read as a draft the send failed to clear.
    if (isSent) return;

    const payload = toAssessmentPayload(form);
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
  }, [form, isSent, toAssessmentPayload, saveDraft, draftKey, formatMessage]);

  // The pure projection makes the close contract explicit and keeps the
  // default placeholder outcome from counting as steward input.
  const { isDirty } = useMemo(
    () => selectAssessmentDirtyState({ currentStep, form, isSubmitting, isSuccess: isSent }),
    [currentStep, form, isSubmitting, isSent]
  );
  const txError = useTxErrorMessages(state.context.error);

  // The answers the latest send carried. A sent assessment leaves the store at
  // once, so the Review reads them from here while it shows the done state.
  const [submittedForm, setSubmittedForm] = useState<CreateAssessmentFormState | null>(null);

  // The flow stays on its Review once the send lands (DL-080): nothing
  // navigates and nothing asks to discard. The sent draft leaves the store, and
  // the browser's saved copy with it, so a reload cannot send the same answers
  // twice.
  useEffect(() => {
    if (isSent) resetStore();
  }, [isSent, resetStore]);

  const handleClose = () => {
    // A sent assessment closes onto the Hub tab that lists it. Any other close
    // returns to the Hub the flow was launched from: closing a Hub create flow
    // must not jump workspaces.
    navigate(
      isSent ? adminRoutes.hubAssess(gardenRouteContext) : adminRoutes.hub(gardenRouteContext)
    );
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

  // The store is already empty once an assessment is sent, so clearing the
  // finished send is all a new one needs.
  const handleCreateAnother = () => {
    setSubmittedForm(null);
    resetWorkflow();
  };

  /** Says why Submit sent nothing. Every refusal here comes before the wallet is asked. */
  const refuseSubmit = (title: MessageDescriptor, message: MessageDescriptor) =>
    toastService.error({
      title: formatMessage(title),
      message: formatMessage(message),
      context: "assessment submission",
      suppressLogging: true,
    });

  const showIncompleteForm = () =>
    refuseSubmit(
      { id: "app.assessment.incompleteForm", defaultMessage: "Incomplete form" },
      {
        id: "app.assessment.incompleteFormMessage",
        defaultMessage: "Check the highlighted fields and try again.",
      }
    );

  const handleSubmit = async () => {
    // The domain step clears a domain this garden does not document, or one
    // that no longer exists, but a restored draft can reopen on a later step
    // and never show it. Such a domain is cleared first, with its actions and
    // metrics, and the steward returns to the domain step to choose again;
    // validation alone would only say the form is incomplete.
    const allowedDomains =
      normalizedGardenDomainMask === undefined
        ? KNOWN_DOMAINS
        : expandDomainMask(normalizedGardenDomainMask);
    if (form.domain !== null && !allowedDomains.includes(form.domain)) {
      setField("domain", null);
      // "Choose a domain" shows on the step the steward lands on.
      stepValidation.showValidationOnStep(0);
      goToStep(0);
      showIncompleteForm();
      return;
    }

    const isFormValid = await stepValidation.validateAll();
    if (!isFormValid) {
      showIncompleteForm();
      return;
    }

    // Which domain an assessment may carry is the garden's to say, so Submit
    // waits while its domains load or after their read failed.
    if (normalizedGardenDomainMask === undefined) {
      refuseSubmit(
        { id: "app.assessment.domainsUnavailable", defaultMessage: "Couldn't check the domain" },
        {
          id: "app.assessment.domainsUnavailableMessage",
          defaultMessage: "This garden's domains have not loaded yet. Try again in a moment.",
        }
      );
      return;
    }

    if (!address) {
      refuseSubmit(
        { id: "app.assessment.accountRequired", defaultMessage: "Sign in required" },
        {
          id: "app.assessment.accountRequiredMessage",
          defaultMessage: "Sign in to your account before submitting an assessment.",
        }
      );
      return;
    }

    const payload = buildWorkflowPayload(form);
    if (!payload) {
      refuseSubmit(
        { id: "app.assessment.selectGarden", defaultMessage: "Select a Garden" },
        {
          id: "app.assessment.selectGardenMessage",
          defaultMessage: "Choose a garden to link this assessment.",
        }
      );
      return;
    }

    // A failed send keeps the answers it was given, and the machine's own retry
    // would send those again. Clearing it first sends the answers as they stand.
    if (hasError) resetWorkflow();
    const started = startCreation(payload);
    if (!started) {
      refuseSubmit(
        {
          id: "app.assessment.couldNotSubmit",
          defaultMessage: "We could not submit the assessment",
        },
        {
          id: "app.assessment.submissionFailedMessage",
          defaultMessage: "Something went wrong. Please try again.",
        }
      );
      return;
    }

    setSubmittedForm(form);
    submitCreation();
  };

  return {
    canReview,
    // The Review stays up through the done state, after the store let the draft go.
    currentStep: isSent ? stepConfigs.length - 1 : currentStep,
    goToStep,
    errorMessage: txError.message,
    errorTitle: txError.title,
    garden,
    handleBack: stepValidation.handleBack,
    handleClose,
    handleCreateAnother,
    handleDiscard,
    handleNext: stepValidation.handleNext,
    handleSubmit,
    hasError,
    isDirty,
    isSent,
    isSubmitting,
    normalizedGardenDomainMask,
    reviewForm: isSent && submittedForm ? submittedForm : form,
    showValidation: stepValidation.showValidation,
    validationAttempt: stepValidation.validationAttempt,
    stepConfigs,
    txErrorView: txError.view,
  };
}
