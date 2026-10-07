import type { Step } from "../../../components/Form/StepIndicator";
import {
  trackAdminActionCreateFailed,
  trackAdminActionCreateStarted,
  trackAdminActionCreateSuccess,
} from "../../../modules/app/analytics-events";
import { logger } from "../../../modules/app/logger";
import { uploadFileToIPFS } from "../../../modules/data/ipfs/upload";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";
import { Domain } from "../../../types/domain";
import { buildActionInstructionsV2 } from "../../../utils/action/translations";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import { parseContractError } from "../../../utils/errors/contract-errors";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import type { CreateActionFormData } from "../../action/useActionForm";
import { useActionOperations } from "../../action/useActionOperations";
import { useFormWizardStepValidation } from "../../ui/useFormWizardStepValidation";
import { useTxErrorMessages } from "../../utils/useTxErrorMessages";
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

/** Where the Review's send stands: nothing sent yet, under way, landed, or failed. */
type CreateActionSend = "idle" | "sending" | "pending" | "sent" | "failed";

export function useCreateActionController() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const {
    registerAction,
    isLoading,
    assertReady,
    pendingRegistration,
    reconcileRegistration,
    registrationScope,
  } = useActionOperations(CREATE_ACTION_DEFAULT_CHAIN_ID);
  const createActionContracts = getNetworkContracts(CREATE_ACTION_DEFAULT_CHAIN_ID);
  const actionCreateGardenAddress = createActionContracts.gardenToken;
  const [currentStep, setCurrentStep] = useState(0);
  const setDraftFormState = useSheetOrchestratorStore((state) => state.setFormState);
  const clearDraftFormState = useSheetOrchestratorStore((state) => state.clearViewState);
  const restoredDraftRef = useRef(false);
  // The send covers the uploads as well as the registration, so the Review
  // holds still from the first press, not only while the wallet is asked.
  const [send, setSend] = useState<CreateActionSend>("idle");
  const [sendError, setSendError] = useState<unknown>(null);
  // Validation runs before onSubmit, so two quick presses can both reach it
  // before the state above re-renders; this lock is set synchronously.
  const sendLockRef = useRef(false);
  const txError = useTxErrorMessages(sendError);
  const mounted = useRef(true);
  const activeScope = useRef(registrationScope);
  activeScope.current = registrationScope;
  const previousScope = useRef(registrationScope);
  const [isCheckingConfirmation, setIsCheckingConfirmation] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  useEffect(() => {
    if (previousScope.current !== registrationScope) {
      previousScope.current = registrationScope;
      sendLockRef.current = false;
      setSend("idle");
      setSendError(null);
      setCurrentStep(0);
      form.reset(createActionDefaultValues());
    }
    if (pendingRegistration) {
      sendLockRef.current = true;
      setSend("pending");
      setCurrentStep(stepConfigs.length - 1);
    }
  }, [registrationScope, pendingRegistration, form, stepConfigs.length]);

  const stepValidation = useFormWizardStepValidation({
    currentStep,
    steps: stepConfigs,
    stepFields: ACTION_STEP_FIELDS,
    trigger: (fields, options) => form.trigger(fields, options),
    onValidNext: () => setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1)),
    onBack: () => setCurrentStep((prev) => Math.max(prev - 1, 0)),
    onStepClick: (stepIndex) =>
      setCurrentStep(Math.max(0, Math.min(stepIndex, stepConfigs.length - 1))),
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
    // One send at a time, and none once the action exists.
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setSend("sending");
    setSendError(null);
    let mutationStarted = false;
    const actionSlug = data.slug.trim().toLowerCase();
    const actionDomain = data.domain as Domain;

    try {
      await assertReady();
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

      const telemetryBase = {
        gardenAddress: actionCreateGardenAddress,
        chainId: CREATE_ACTION_DEFAULT_CHAIN_ID,
        actionTitle: data.title,
        actionSlug,
        actionDomain,
      };

      mutationStarted = true;
      trackAdminActionCreateStarted(telemetryBase);

      const result = await registerAction({
        title: data.title,
        slug: actionSlug,
        domain: actionDomain,
        startTime: Math.floor(data.startTime.getTime() / 1000),
        endTime: Math.floor(data.endTime.getTime() / 1000),
        capitals: data.capitals,
        media: mediaCIDs,
        instructions: instructionsUpload.cid,
      });

      if (result.confirmation === "pending") {
        setSend("pending");
        return;
      }
      if (!result.success) {
        const errorMessage = result.error?.message ?? "Action registration failed";
        mutationStarted = false;
        // Telemetry carries the parsed error family only — raw messages can
        // embed steward-typed content (work/auth telemetry follow the same rule).
        const parsedFamily = parseContractError(result.error ?? errorMessage).name;
        trackAdminActionCreateFailed({
          ...telemetryBase,
          error: parsedFamily,
          parsedErrorFamily: parsedFamily,
        });
        throw new Error(errorMessage);
      }

      trackAdminActionCreateSuccess({
        ...telemetryBase,
        txHash: result.hash ?? "",
      });

      // The flow stays on its Review once the action exists (DL-080): nothing
      // navigates and nothing asks to discard. The draft goes at once, so a
      // reload cannot register the same action twice.
      clearDraftFormState(ACTION_CREATE_DRAFT_PATH);
      clearCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH);
      setSend("sent");
    } catch (error) {
      logger.error("Failed to create action", {
        source: "CreateAction.onSubmit",
        error: error instanceof Error ? error.message : String(error),
        title: data.title,
        mediaCount: data.media.length,
      });
      if (mutationStarted) {
        const parsedFamily = parseContractError(error).name;
        trackAdminActionCreateFailed({
          gardenAddress: actionCreateGardenAddress,
          chainId: CREATE_ACTION_DEFAULT_CHAIN_ID,
          actionTitle: data.title,
          actionSlug,
          actionDomain,
          error: parsedFamily,
          parsedErrorFamily: parsedFamily,
        });
      }

      // The Review's status row says what happened; Try Again sends the
      // answers as they stand.
      setSendError(error);
      setSend("failed");
      sendLockRef.current = false;
    }
  };

  const checkConfirmation = async () => {
    if (isCheckingConfirmation) return;
    const scope = registrationScope;
    setIsCheckingConfirmation(true);
    try {
      const result = await reconcileRegistration();
      if (!mounted.current || activeScope.current !== scope) return;
      if (result.confirmation === "pending") return;
      if (result.success) {
        clearDraftFormState(ACTION_CREATE_DRAFT_PATH);
        clearCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH);
        setSend("sent");
      } else {
        setSendError(
          new Error(
            result.error?.message ??
              formatMessage({
                id: "app.account.transactionReverted",
                defaultMessage: "Transaction reverted. The action was not recorded.",
              })
          )
        );
        setSend("failed");
        sendLockRef.current = false;
      }
    } finally {
      if (mounted.current) setIsCheckingConfirmation(false);
    }
  };

  const handleCancel = () => {
    navigate(actionsListHref);
  };

  // The draft left with the send, so a new action starts from empty answers.
  const handleCreateAnother = () => {
    if (send !== "sent") return;
    sendLockRef.current = false;
    form.reset(createActionDefaultValues());
    setSend("idle");
    setSendError(null);
    setCurrentStep(0);
  };

  // Discard clears the persisted draft (media + form state) before leaving, so a
  // confirmed "Discard" from the dialog's close guard doesn't silently resurrect
  // the abandoned action next time. Plain Cancel keeps the draft for resume.
  const handleDiscard = () => {
    clearDraftFormState(ACTION_CREATE_DRAFT_PATH);
    clearCreateActionMediaDraft(ACTION_CREATE_DRAFT_PATH);
    navigate(actionsListHref);
  };

  const isSent = send === "sent";
  const isPendingRegistration = send === "pending" || Boolean(pendingRegistration);

  return {
    currentStep,
    domainOptions,
    errorMessage: txError.message,
    errorTitle: txError.title,
    form,
    goToStep: stepValidation.handleStepClick,
    handleBack: stepValidation.handleBack,
    handleCancel,
    handleCreateAnother,
    handleDiscard,
    handleNext: stepValidation.handleNext,
    hasError: send === "failed",
    // A registered action is not in progress, so closing its done state never asks.
    isDirty: form.formState.isDirty && !isSent,
    isSending: send === "sending" || isLoading || isPendingRegistration,
    isPendingRegistration,
    isCheckingConfirmation,
    checkConfirmation,
    isSent,
    onSubmit,
    stepConfigs,
    txErrorView: txError.view,
  };
}
