import {
  type CreateActionFormData,
  adminRoutes,
  buildActionInstructionsV2,
  Domain,
  logger,
  type Step,
  toastService,
  uploadFileToIPFS,
  useActionOperations,
  useFormWizardStepValidation,
  useSheetOrchestratorStore,
} from "@green-goods/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ACTION_STEP_FIELDS,
  CREATE_ACTION_DEFAULT_CHAIN_ID,
  createActionDefaultValues,
  createActionResolver,
} from "./createAction.utils";
import { getActionsListSearch } from "./actions.utils";
import {
  ACTION_CREATE_DRAFT_PATH,
  clearCreateActionMediaDraft,
  restoreCreateActionDraft,
  saveCreateActionMediaDraft,
  serializeCreateActionDraft,
} from "./actionDrafts";

export function useCreateActionController() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const { registerAction, isLoading } = useActionOperations(CREATE_ACTION_DEFAULT_CHAIN_ID);
  const [currentStep, setCurrentStep] = useState(0);
  const setDraftFormState = useSheetOrchestratorStore((state) => state.setFormState);
  const clearDraftFormState = useSheetOrchestratorStore((state) => state.clearViewState);
  const restoredDraftRef = useRef(false);

  const domainOptions = [
    {
      value: Domain.SOLAR,
      label: formatMessage({ id: "app.domain.tab.solar", defaultMessage: "Solar" }),
    },
    {
      value: Domain.AGRO,
      label: formatMessage({ id: "app.domain.tab.agro", defaultMessage: "Agroforestry" }),
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
    resolver: createActionResolver,
    defaultValues: createActionDefaultValues(),
  });

  useEffect(() => {
    if (restoredDraftRef.current) return;
    restoredDraftRef.current = true;

    const savedDraft =
      useSheetOrchestratorStore.getState().restoreViewState(ACTION_CREATE_DRAFT_PATH)?.formState ??
      null;
    const restoredDraft = restoreCreateActionDraft(savedDraft, ACTION_CREATE_DRAFT_PATH);
    if (!restoredDraft) return;

    form.reset(restoredDraft.values);
    setCurrentStep(Math.max(0, Math.min(restoredDraft.currentStep, stepConfigs.length - 1)));
  }, [form, stepConfigs.length]);

  const stepValidation = useFormWizardStepValidation({
    currentStep,
    steps: stepConfigs,
    stepFields: ACTION_STEP_FIELDS,
    trigger: (fields, options) => form.trigger(fields, options),
    onValidNext: () => setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1)),
    onBack: () => setCurrentStep((prev) => Math.max(prev - 1, 0)),
  });
  const listSearch = getActionsListSearch(new URLSearchParams(location.search));
  const actionsListHref = adminRoutes.actions(listSearch);

  useEffect(() => {
    const subscription = form.watch((value) => {
      saveCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH, value.media);
      setDraftFormState(
        ACTION_CREATE_DRAFT_PATH,
        serializeCreateActionDraft(
          value as Partial<CreateActionFormData>,
          currentStep
        ) as unknown as Record<string, unknown>
      );
    });

    return () => subscription.unsubscribe();
  }, [currentStep, form, setDraftFormState]);

  useEffect(() => {
    const value = form.getValues();
    saveCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH, value.media);
    setDraftFormState(
      ACTION_CREATE_DRAFT_PATH,
      serializeCreateActionDraft(value, currentStep) as unknown as Record<string, unknown>
    );
  }, [currentStep, form, setDraftFormState]);

  const onSubmit = async (data: CreateActionFormData) => {
    try {
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

      const instructionMetadata = buildActionInstructionsV2(
        data.title,
        data.instructionConfig,
        data.translations
      );
      const instructionsBlob = new Blob([JSON.stringify(instructionMetadata, null, 2)], {
        type: "application/json",
      });
      const instructionsFile = new File([instructionsBlob], "instructions.json", {
        type: "application/json",
      });
      const instructionsUpload = await uploadFileToIPFS(instructionsFile);

      toastService.dismiss();

      await registerAction({
        title: data.title,
        slug: data.slug.trim().toLowerCase(),
        domain: data.domain as Domain,
        startTime: Math.floor(data.startTime.getTime() / 1000),
        endTime: Math.floor(data.endTime.getTime() / 1000),
        capitals: data.capitals,
        media: mediaCIDs,
        instructions: instructionsUpload.cid,
      });

      clearDraftFormState(ACTION_CREATE_DRAFT_PATH);
      clearCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH);
      navigate(actionsListHref);
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

  const handleCancel = () => {
    navigate(actionsListHref);
  };

  return {
    currentStep,
    domainOptions,
    form,
    handleBack: stepValidation.handleBack,
    handleCancel,
    handleNext: stepValidation.handleNext,
    isLoading,
    onSubmit,
    stepConfigs,
  };
}
