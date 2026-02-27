import {
  classifyTxError,
  gardenStepFields,
  isMeaningfulTxErrorMessage,
  toastService,
  useCreateGardenForm,
  useCreateGardenStore,
  useCreateGardenWorkflow,
} from "@green-goods/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { TxInlineFeedback } from "@/components/feedback/TxInlineFeedback";
import { FormWizard } from "@/components/Form/FormWizard";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";
import { Button } from "@/components/ui/Button";

export default function CreateGarden() {
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

  const {
    state,
    openFlow,
    closeFlow,
    goNext,
    goBack,
    goToReview,
    submitCreation,
    retry,
    draft,
  } = useCreateGardenWorkflow();
  const { loadDraft } = draft;

  const [showValidation, setShowValidation] = useState(false);

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";
  const txErrorView = useMemo(() => classifyTxError(state.context.error), [state.context.error]);
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
        // Reconcile XState machine with persisted step position.
        // openFlow() moved the machine to "collecting", but if the user was on
        // the review step before refresh, advance the machine to match.
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
            defaultMessage: "Add planned members next",
          }),
          message: intl.formatMessage(
            {
              id: "app.admin.garden.create.teamAssignmentReminder.message",
              defaultMessage:
                "{count} planned members were not assigned during deployment. Add them from Garden Members.",
            },
            { count: plannedMemberCount }
          ),
          context: "garden creation",
          suppressLogging: true,
        });
      }
      resetForm();
      navigate("/gardens");
    }
  }, [isSuccess, navigate, resetForm, intl, plannedMemberCount]);

  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  useEffect(() => {
    resetValidationForm(form);
  }, [form, resetValidationForm]);

  const handleNext = async () => {
    setShowValidation(true);
    const currentStepId = steps[currentStep]?.id;
    if (currentStepId && currentStepId !== "review") {
      const fields = gardenStepFields[currentStepId];
      const isStepValid = await trigger([...fields], { shouldFocus: true });
      if (!isStepValid) return;
    }
    goNext();
  };

  const handleBack = () => {
    setShowValidation(false);
    goBack();
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    const isFormValid = await trigger(undefined, { shouldFocus: true });
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
      return;
    }
  };

  const handleCancel = () => {
    closeFlow();
    navigate("/gardens");
  };

  const handleStepClick = (stepIndex: number) => {
    setShowValidation(false);
    goToStep(stepIndex);
  };

  const currentStepConfig = steps[currentStep];
  const isDetailsStep = currentStepConfig?.id === "details";
  const isTeamStep = currentStepConfig?.id === "team";
  const isReviewStepActive = currentStepConfig?.id === "review";
  const errorTitle = intl.formatMessage({
    id: txErrorView.titleKey,
    defaultMessage:
      txErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const errorMessage =
    txErrorView.kind === "cancelled"
      ? intl.formatMessage({
          id: txErrorView.messageKey,
          defaultMessage: "Transaction was cancelled. Please try again when ready.",
        })
      : isMeaningfulTxErrorMessage(txErrorView.rawMessage)
        ? txErrorView.rawMessage
        :
        intl.formatMessage({
          id: txErrorView.messageKey,
          defaultMessage: "Please review the details and try again.",
        });

  return (
    <FormWizard
      steps={steps}
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      onStepClick={handleStepClick}
      isSubmitting={isSubmitting}
      nextLabel={intl.formatMessage({
        id: "admin.garden.form.continue",
        defaultMessage: "Continue",
      })}
      submitLabel={intl.formatMessage({
        id: "admin.garden.form.deploy",
        defaultMessage: "Deploy garden",
      })}
    >
      <TxInlineFeedback
        visible={hasError}
        severity={txErrorView.severity}
        title={errorTitle}
        message={errorMessage}
        reserveClassName="min-h-[8.25rem]"
        className="mb-4"
        action={
          <Button variant="secondary" size="sm" onClick={retry}>
            {intl.formatMessage({
              id: "admin.garden.deploy.retry",
              defaultMessage: "Retry deployment",
            })}
          </Button>
        }
      />
      {isDetailsStep && <DetailsStep showValidation={showValidation} />}
      {isTeamStep && <TeamStep />}
      {isReviewStepActive && <ReviewStep />}
    </FormWizard>
  );
}
