import {
  clearFormDraft,
  type CreateAssessmentForm as WorkflowAssessmentForm,
  loadFormDraft,
  saveFormDraft,
  toastService,
  useAdminStore,
  useCreateAssessmentWorkflow,
  useGardenDomains,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiErrorWarningLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

export default function CreateAssessment() {
  const { id: gardenId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const lastAttestationId = useAdminStore((s) => s.lastAttestationId);
  const setLastAttestationId = useAdminStore((s) => s.setLastAttestationId);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: gardenDomainMask } = useGardenDomains(gardenId);

  const DRAFT_KEY = `assessment-v2-draft-${gardenId}`;

  const {
    state,
    startCreation,
    submitCreation,
    retry,
    reset: resetWorkflow,
    canRetry,
  } = useCreateAssessmentWorkflow();

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

  const isSubmitting = state.matches("submitting");
  const hasError = state.matches("error");
  const isSuccess = state.matches("success");

  // Load draft on mount
  useEffect(() => {
    const draft = loadFormDraft<CreateAssessmentForm>(DRAFT_KEY);
    if (draft) {
      resetForm(draft);
    }
  }, [DRAFT_KEY, resetForm]);

  // Save draft on form change
  useEffect(() => {
    const subscription = watch((value) => {
      saveFormDraft(DRAFT_KEY, value);
    });
    return () => subscription.unsubscribe();
  }, [watch, DRAFT_KEY]);

  // Navigate on success
  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: "Assessment submitted",
        message: "Your assessment has been recorded on-chain",
        context: "assessment submission",
        suppressLogging: true,
      });
      clearFormDraft(DRAFT_KEY);
      navigate(`/gardens/${gardenId}/assessments`);
    }
  }, [isSuccess, navigate, gardenId, DRAFT_KEY]);

  useEffect(() => {
    if (lastAttestationId) {
      setLastAttestationId(null);
    }
  }, [lastAttestationId, setLastAttestationId]);

  useEffect(() => {
    resetWorkflow();
  }, [resetWorkflow]);

  const onValid = async (formData: CreateAssessmentForm) => {
    try {
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

      // Build workflow payload from v2 form data
      // The workflow hook still expects the old CreateAssessmentForm shape,
      // so we map the new fields to the existing interface.
      // This mapping will be updated when the workflow hook is upgraded.
      const payload: WorkflowAssessmentForm & { gardenId: string } = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        // Map new fields to legacy interface until workflow is upgraded
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
        startDate: Math.floor(new Date(formData.reportingPeriodStart).getTime() / 1000),
        endDate: Math.floor(new Date(formData.reportingPeriodEnd).getTime() / 1000),
        location: formData.location.trim(),
        tags: formData.sdgTargets.map((id) => `sdg-${id}`),
        gardenId,
      };

      startCreation(payload);
      const uid = await submitCreation();
      setLastAttestationId(uid);
    } catch (error) {
      toastService.error({
        title: "Submission failed",
        message: "Something went wrong. Please try again.",
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
      title: "Incomplete form",
      message: "Check the highlighted fields and try again.",
      context: "assessment submission",
      suppressLogging: true,
    });
  });

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
    <>
      {hasError && (
        <div className="fixed inset-x-0 top-[120px] z-20 mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-error-light bg-error-lighter p-4 text-sm text-error-dark shadow-lg">
            <RiErrorWarningLine className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-error-dark">We could not submit the assessment</p>
              <p className="mt-1 text-error-dark/80">
                {state.context.error ?? "Please review the details and try again."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={retry}
                  disabled={!canRetry || isSubmitting}
                  className="rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Retry submission
                </button>
                <button
                  onClick={() => resetWorkflow()}
                  className="rounded-md border border-stroke-soft px-3 py-1.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                >
                  Edit details
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
          nextLabel="Continue"
          submitLabel="Submit assessment"
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
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
              gardenDomainMask={typeof gardenDomainMask === "number" ? gardenDomainMask : undefined}
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
    </>
  );
}
