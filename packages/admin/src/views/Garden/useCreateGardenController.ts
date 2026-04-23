import {
  gardenStepFields,
  toastService,
  useCreateGardenForm,
  useCreateGardenStore,
  useCreateGardenWorkflow,
  useFormWizardStepValidation,
  useTxErrorMessages,
} from "@green-goods/shared";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

export function useCreateGardenController() {
  const intl = useIntl();
  const navigate = useNavigate();
  const steps = useCreateGardenStore((state) => state.steps);
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const form = useCreateGardenStore(useShallow((state) => state.form));
  const resetForm = useCreateGardenStore((state) => state.reset);
  const goToStep = useCreateGardenStore((state) => state.goToStep);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const { trigger, reset: resetValidationForm } = useCreateGardenForm();
  const { state, openFlow, closeFlow, goNext, goBack, goToReview, submitCreation, retry, draft } =
    useCreateGardenWorkflow();
  const { loadDraft } = draft;

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";
  const txError = useTxErrorMessages(state.context.error);
  const plannedMemberCount = form.gardeners.length + form.operators.length;
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    const initializeFlow = async () => {
      openFlow();

      const storeState = useCreateGardenStore.getState();
      const storeForm = storeState.form;
      const hasSessionProgress =
        storeForm.name.trim().length > 0 ||
        storeForm.slug.trim().length > 0 ||
        storeForm.description.trim().length > 0 ||
        storeForm.location.trim().length > 0 ||
        storeForm.bannerImage.trim().length > 0 ||
        storeForm.metadata.trim().length > 0 ||
        storeForm.openJoining ||
        storeForm.gardeners.length > 0 ||
        storeForm.operators.length > 0;

      if (hasSessionProgress) {
        const isOnReviewStep = storeState.currentStep === storeState.steps.length - 1;
        if (isOnReviewStep && storeState.isReviewReady()) {
          goToReview();
        }
        return;
      }

      const restoredDraft = await loadDraft();
      if (cancelled || !restoredDraft) return;
    };

    void initializeFlow();

    return () => {
      cancelled = true;
    };
  }, [openFlow, goToReview, loadDraft]);

  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: intl.formatMessage({
          id: "admin.garden.created.title",
          defaultMessage: "Garden created",
        }),
        message: intl.formatMessage({
          id: "admin.garden.created.message",
          defaultMessage: "Your garden has been deployed successfully",
        }),
        context: "garden creation",
        suppressLogging: true,
      });
      if (plannedMemberCount > 0) {
        toastService.info({
          title: intl.formatMessage({
            id: "app.admin.garden.create.teamAssignmentReminder.title",
            defaultMessage: "Verify planned members",
          }),
          message: intl.formatMessage(
            {
              id: "app.admin.garden.create.teamAssignmentReminder.message",
              defaultMessage:
                "{count} planned members were included in deployment. Verify their roles from Garden Members after indexing catches up.",
            },
            { count: plannedMemberCount }
          ),
          context: "garden creation",
          suppressLogging: true,
        });
      }
      resetForm();
      navigate("/garden");
    }
  }, [isSuccess, navigate, resetForm, intl, plannedMemberCount]);

  const formKey = JSON.stringify(form);
  useEffect(() => {
    resetValidationForm(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const stepValidation = useFormWizardStepValidation({
    currentStep,
    steps,
    stepFields: gardenStepFields,
    trigger: (fields, options) => trigger(fields as Parameters<typeof trigger>[0], options),
    onValidNext: goNext,
    onBack: goBack,
    onStepClick: goToStep,
  });

  const handleSubmit = async () => {
    const isFormValid = await stepValidation.validateAll();
    if (!isFormValid) return;

    if (!isOnline) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.admin.garden.create.offline.title",
          defaultMessage: "You're offline",
        }),
        message: intl.formatMessage({
          id: "app.admin.garden.create.offline.message",
          defaultMessage: "Reconnect to the internet before deploying this garden.",
        }),
        context: "garden creation",
      });
      return;
    }

    const started = submitCreation();
    if (!started) {
      toastService.error({
        title: intl.formatMessage({
          id: "admin.garden.deploy.notReady.title",
          defaultMessage: "Cannot deploy yet",
        }),
        message: intl.formatMessage({
          id: "admin.garden.deploy.notReady.message",
          defaultMessage:
            "The form isn't ready for submission. Please go back and check all fields.",
        }),
        context: "garden creation",
      });
    }
  };

  const handleCancel = () => {
    closeFlow();
    navigate("/garden");
  };

  const currentStepConfig = steps[currentStep];

  return {
    currentStep,
    errorMessage: txError.message,
    errorTitle: txError.title,
    handleBack: stepValidation.handleBack,
    handleCancel,
    handleNext: stepValidation.handleNext,
    handleStepClick: stepValidation.handleStepClick,
    handleSubmit,
    hasError,
    isDetailsStep: currentStepConfig?.id === "details",
    isReviewStepActive: currentStepConfig?.id === "review",
    isSubmitting,
    isTeamStep: currentStepConfig?.id === "team",
    retry,
    showValidation: stepValidation.showValidation,
    steps,
    txErrorView: txError.view,
  };
}
