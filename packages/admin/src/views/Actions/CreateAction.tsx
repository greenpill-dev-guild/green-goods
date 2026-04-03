import {
  type CreateActionFormData,
  createActionSchema,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  Domain,
  logger,
  toastService,
  uploadFileToIPFS,
  useActionOperations,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  BasicsStep,
  CapitalsStep,
  InstructionsStep,
  ReviewStep,
} from "@/components/Action/CreateActionSteps";
import { FormWizard } from "@/components/Form/FormWizard";
import type { Step } from "@/components/Form/StepIndicator";

export default function CreateAction() {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { registerAction, isLoading } = useActionOperations(DEFAULT_CHAIN_ID);
  const [currentStep, setCurrentStep] = useState(0);
  const domainOptions = [
    {
      value: Domain.SOLAR,
      label: formatMessage({ id: "app.domain.tab.solar", defaultMessage: "Solar" }),
    },
    {
      value: Domain.AGRO,
      label: formatMessage({ id: "app.domain.tab.agro", defaultMessage: "Agro" }),
    },
    {
      value: Domain.EDU,
      label: formatMessage({ id: "app.domain.tab.education", defaultMessage: "Education" }),
    },
    {
      value: Domain.WASTE,
      label: formatMessage({ id: "app.domain.tab.waste", defaultMessage: "Waste" }),
    },
  ];

  const stepConfigs: Step[] = [
    {
      id: "basics",
      title: formatMessage({ id: "app.admin.actions.create.stepBasics", defaultMessage: "Basics" }),
      description: formatMessage({
        id: "app.admin.actions.create.stepBasicsDesc",
        defaultMessage: "Title and timeline",
      }),
    },
    {
      id: "capitals",
      title: formatMessage({
        id: "app.admin.actions.create.stepCapitals",
        defaultMessage: "Capitals & Media",
      }),
      description: formatMessage({
        id: "app.admin.actions.create.stepCapitalsDesc",
        defaultMessage: "Forms of capital and images",
      }),
    },
    {
      id: "instructions",
      title: formatMessage({
        id: "app.admin.actions.create.stepInstructions",
        defaultMessage: "Instructions",
      }),
      description: formatMessage({
        id: "app.admin.actions.create.stepInstructionsDesc",
        defaultMessage: "Define work submission form",
      }),
    },
    {
      id: "review",
      title: formatMessage({ id: "app.admin.actions.create.stepReview", defaultMessage: "Review" }),
      description: formatMessage({
        id: "app.admin.actions.create.stepReviewDesc",
        defaultMessage: "Confirm and submit",
      }),
    },
  ];

  const form = useForm<CreateActionFormData>({
    resolver: zodResolver(createActionSchema),
    defaultValues: {
      title: "",
      slug: "",
      domain: Domain.SOLAR,
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      capitals: [],
      media: [],
      instructionConfig: defaultTemplate,
    },
  });

  const onSubmit = async (data: CreateActionFormData) => {
    try {
      // Upload media to IPFS
      toastService.loading({
        title: formatMessage({
          id: "app.admin.actions.create.uploadingMedia",
          defaultMessage: "Uploading media to IPFS...",
        }),
      });
      const mediaUploads = await Promise.all(
        data.media.map((file: File) => uploadFileToIPFS(file))
      );
      const mediaCIDs = mediaUploads.map((upload: { cid: string }) => upload.cid);

      // Convert instruction config to JSON and upload to IPFS
      const instructionsBlob = new Blob([JSON.stringify(data.instructionConfig, null, 2)], {
        type: "application/json",
      });
      const instructionsFile = new File([instructionsBlob], "instructions.json", {
        type: "application/json",
      });
      const instructionsUpload = await uploadFileToIPFS(instructionsFile);
      const instructionsCID = instructionsUpload.cid;

      toastService.dismiss();

      // Register action on-chain
      await registerAction({
        title: data.title,
        slug: data.slug.trim().toLowerCase(),
        domain: data.domain as Domain,
        startTime: Math.floor(data.startTime.getTime() / 1000),
        endTime: Math.floor(data.endTime.getTime() / 1000),
        capitals: data.capitals,
        media: mediaCIDs,
        instructions: instructionsCID,
      });

      navigate("/actions");
    } catch (error) {
      logger.error("Failed to create action", {
        source: "CreateAction.onSubmit",
        error: error instanceof Error ? error.message : String(error),
        title: data.title,
        mediaCount: data.media.length,
      });
      toastService.error({
        title: formatMessage({
          id: "app.admin.actions.create.errorTitle",
          defaultMessage: "Failed to create action",
        }),
        context: formatMessage({
          id: "app.admin.actions.create.errorContext",
          defaultMessage: "action creation",
        }),
        error,
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicsStep form={form} domainOptions={domainOptions} />;
      case 1:
        return <CapitalsStep form={form} />;
      case 2:
        return <InstructionsStep form={form} />;
      case 3:
        return <ReviewStep form={form} domainOptions={domainOptions} />;
      default:
        return null;
    }
  };

  // Fields to validate per wizard step before advancing
  const stepFields: Record<number, (keyof CreateActionFormData)[]> = {
    0: ["title", "slug", "domain", "startTime", "endTime"],
    1: ["capitals"],
  };

  const handleNext = async () => {
    const fields = stepFields[currentStep];
    if (fields) {
      const valid = await form.trigger(fields, { shouldFocus: true });
      if (!valid) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCancel = () => {
    navigate("/actions");
  };

  return (
    <FormWizard
      steps={stepConfigs}
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={handleCancel}
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={isLoading}
    >
      {renderStep()}
    </FormWizard>
  );
}
