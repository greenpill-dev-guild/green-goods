import { toastService, useCreateGardenStore, useCreateGardenWorkflow } from "@green-goods/shared";
import { RiErrorWarningLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormWizard } from "@/components/Form/FormWizard";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";

export default function CreateGarden() {
  const navigate = useNavigate();
  const steps = useCreateGardenStore((state) => state.steps);
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const canProceed = useCreateGardenStore((state) => state.canProceed);
  const isReviewReady = useCreateGardenStore((state) => state.isReviewReady);
  const resetForm = useCreateGardenStore((state) => state.reset);

  const { state, openFlow, closeFlow, goNext, goBack, submitCreation, retry } =
    useCreateGardenWorkflow();

  const [showValidation, setShowValidation] = useState(false);

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";

  // Open flow on mount — Zustand persist middleware handles draft restoration
  useEffect(() => {
    openFlow();
  }, [openFlow]);

  // Navigate on success
  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: "Garden created",
        message: "Your garden has been deployed successfully",
        context: "garden creation",
        suppressLogging: true,
      });
      resetForm();
      navigate("/gardens");
    }
  }, [isSuccess, navigate, resetForm]);

  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  const handleNext = () => {
    setShowValidation(true);
    if (!canProceed()) {
      return;
    }
    goNext();
  };

  const handleBack = () => {
    setShowValidation(false);
    goBack();
  };

  const handleSubmit = () => {
    setShowValidation(true);
    if (!isReviewReady()) {
      return;
    }
    submitCreation();
  };

  const handleCancel = () => {
    closeFlow();
    navigate("/gardens");
  };

  const currentStepConfig = steps[currentStep];
  const isDetailsStep = currentStepConfig?.id === "details";
  const isTeamStep = currentStepConfig?.id === "team";
  const isReviewStepActive = currentStepConfig?.id === "review";

  return (
    <>
      {hasError && (
        <div className="fixed inset-x-0 top-[120px] z-20 mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-error-light bg-error-lighter p-4 text-sm text-error-dark shadow-lg">
            <RiErrorWarningLine className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-error-dark">We couldn&apos;t deploy the garden</p>
              <p className="mt-1 text-error-dark/80">
                {state.context.error ?? "Please review the details and try again."}
              </p>
              <button
                onClick={retry}
                className="mt-3 rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-lighter"
              >
                Retry deployment
              </button>
            </div>
          </div>
        </div>
      )}

      <FormWizard
        steps={steps}
        currentStep={currentStep}
        onNext={handleNext}
        onBack={handleBack}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        nextLabel="Continue"
        submitLabel="Deploy garden"
      >
        {isDetailsStep && <DetailsStep showValidation={showValidation} />}
        {isTeamStep && <TeamStep showValidation={showValidation} />}
        {isReviewStepActive && <ReviewStep />}
      </FormWizard>
    </>
  );
}
