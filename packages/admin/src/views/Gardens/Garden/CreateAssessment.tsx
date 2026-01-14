import { toastService } from "@green-goods/shared";
import { useCreateAssessmentWorkflow } from "@green-goods/shared/hooks";
import { useAdminStore } from "@green-goods/shared/stores";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@green-goods/shared/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiErrorWarningLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { EvidenceStep } from "@/components/Assessment/CreateAssessmentSteps/EvidenceStep";
import { OverviewStep } from "@/components/Assessment/CreateAssessmentSteps/OverviewStep";
import { ReviewStep } from "@/components/Assessment/CreateAssessmentSteps/ReviewStep";
import {
  type CreateAssessmentForm,
  createAssessmentSchema,
  createDefaultAssessmentForm,
} from "@/components/Assessment/CreateAssessmentSteps/shared";
import { TimelineStep } from "@/components/Assessment/CreateAssessmentSteps/TimelineStep";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";

const stepConfigs: Step[] = [
  {
    id: "overview",
    title: "Overview",
    description: "Title, type, description, and capitals",
  },
  {
    id: "timeline",
    title: "Timeline & location",
    description: "Dates, location, and tags",
  },
  {
    id: "evidence",
    title: "Metrics & evidence",
    description: "Metrics JSON, media, and references",
  },
  {
    id: "review",
    title: "Review",
    description: "Confirm details before submitting",
  },
];

export default function CreateAssessment() {
  const { id: gardenId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { lastAttestationId, setLastAttestationId } = useAdminStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const DRAFT_KEY = `assessment-draft-${gardenId}`;

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
    getValues,
    setValue,
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
      if (draft.evidenceMedia) {
        setEvidenceFiles(draft.evidenceMedia as File[]);
      }
    }
  }, [DRAFT_KEY, resetForm]);

  // Save draft on form change
  useEffect(() => {
    const subscription = watch((value) => {
      saveFormDraft(DRAFT_KEY, { ...value, evidenceMedia: evidenceFiles });
    });
    return () => subscription.unsubscribe();
  }, [watch, DRAFT_KEY, evidenceFiles]);

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
    setValue("evidenceMedia", evidenceFiles as any, { shouldDirty: true });
  }, [evidenceFiles, setValue]);

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

  const handleNextStep = async () => {
    const step = stepConfigs[currentStep];
    if (!step) return;

    // Map step IDs to field names
    const fieldMap: Record<string, Array<keyof CreateAssessmentForm>> = {
      overview: ["title", "assessmentType", "description", "capitals"],
      timeline: ["startDate", "endDate", "location", "tags"],
      evidence: ["metrics", "reportDocuments", "impactAttestations"],
    };

    const fields = fieldMap[step.id];
    if (fields) {
      const valid = await trigger(fields as any, { shouldFocus: true });
      if (!valid) {
        return;
      }
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

  const shouldShowReview = stepConfigs[currentStep]?.id === "review";

  // Check if current step fields are valid
  const isCurrentStepValid = () => {
    const step = stepConfigs[currentStep];
    if (!step || step.id === "review") return true;

    const fieldMap: Record<string, Array<keyof CreateAssessmentForm>> = {
      overview: ["title", "assessmentType", "description", "capitals"],
      timeline: ["startDate", "endDate", "location"],
      evidence: ["metrics"],
    };

    const fields = fieldMap[step.id];
    if (!fields) return true;

    // Check if any of the required fields have errors
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
          {stepConfigs[currentStep]?.id === "overview" && (
            <OverviewStep
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
            />
          )}
          {stepConfigs[currentStep]?.id === "timeline" && (
            <TimelineStep
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
            />
          )}
          {stepConfigs[currentStep]?.id === "evidence" && (
            <EvidenceStep
              register={register}
              errors={errors}
              control={control}
              isSubmitting={isSubmitting}
              evidenceFiles={evidenceFiles}
              setEvidenceFiles={setEvidenceFiles}
              setValue={setValue}
              getValues={getValues}
            />
          )}
          {shouldShowReview && <ReviewStep watch={watch} evidenceFiles={evidenceFiles} />}
        </FormWizard>
      </form>
    </>
  );
}
