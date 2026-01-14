import { toastService } from "@green-goods/shared";
import { useCreateGardenWorkflow } from "@green-goods/shared/hooks";
import { type CreateGardenFormState, useCreateGardenStore } from "@green-goods/shared/stores";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@green-goods/shared/utils";
import { RiErrorWarningLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormWizard } from "@/components/Form/FormWizard";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";

const DRAFT_KEY = "garden-create-draft";

export default function CreateGarden() {
  const navigate = useNavigate();
  const form = useCreateGardenStore((state) => state.form);
  const steps = useCreateGardenStore((state) => state.steps);
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const setField = useCreateGardenStore((state) => state.setField);
  const addGardener = useCreateGardenStore((state) => state.addGardener);
  const removeGardener = useCreateGardenStore((state) => state.removeGardener);
  const addOperator = useCreateGardenStore((state) => state.addOperator);
  const removeOperator = useCreateGardenStore((state) => state.removeOperator);
  const canProceed = useCreateGardenStore((state) => state.canProceed);
  const isReviewReady = useCreateGardenStore((state) => state.isReviewReady);
  const nextStep = useCreateGardenStore((state) => state.nextStep);
  const previousStep = useCreateGardenStore((state) => state.previousStep);
  const resetForm = useCreateGardenStore((state) => state.reset);

  const { state, openFlow, closeFlow, goNext, goBack, submitCreation, retry } =
    useCreateGardenWorkflow();

  const [showValidation, setShowValidation] = useState(false);

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";

  // Load draft on mount
  useEffect(() => {
    const draft = loadFormDraft<CreateGardenFormState>(DRAFT_KEY);
    if (draft) {
      // Type-safe iteration over draft fields
      (Object.keys(draft) as Array<keyof CreateGardenFormState>).forEach((key) => {
        setField(key, draft[key]);
      });
    }
    openFlow();
  }, [openFlow, setField]);

  // Save draft on form change
  useEffect(() => {
    saveFormDraft(DRAFT_KEY, form);
  }, [form]);

  // Navigate on success
  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: "Garden created",
        message: "Your garden has been deployed successfully",
        context: "garden creation",
        suppressLogging: true,
      });
      clearFormDraft(DRAFT_KEY);
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
    nextStep();
  };

  const handleBack = () => {
    setShowValidation(false);
    goBack();
    previousStep();
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
  const isReviewStep = currentStepConfig?.id === "review";

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
        {isDetailsStep && (
          <DetailsStep form={form} setField={setField} showValidation={showValidation} />
        )}
        {isTeamStep && (
          <TeamStep
            form={form}
            addGardener={addGardener}
            removeGardener={removeGardener}
            addOperator={addOperator}
            removeOperator={removeOperator}
            showValidation={showValidation}
          />
        )}
        {isReviewStep && <ReviewStep form={form} />}
      </FormWizard>
    </>
  );
}
