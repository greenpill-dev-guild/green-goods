import { useOnlineStatus } from "../../app/useOnlineStatus";
import { toastService } from "../../../components/Toast/toast.service";
import { gardensKeys } from "../../../config/query-keys/garden";
import { readCreatedGardenAddress } from "../../../modules/garden/create-garden-command";
import { getAdminGardenScopeKey, useAdminStore } from "../../../stores/useAdminStore";
import { type CreateGardenStep, useCreateGardenStore } from "../../../stores/useCreateGardenStore";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { readSlugAvailability } from "../../ens/useSlugAvailability";
import { gardenStepFields, useCreateGardenForm } from "../../garden/useCreateGardenForm";
import { useCreateGardenWorkflow } from "../../garden/useCreateGardenWorkflow";
import { useFormWizardStepValidation } from "../../ui/useFormWizardStepValidation";
import { useAsyncEffect } from "../../utils/useAsyncEffect";
import { useTxErrorMessages } from "../../utils/useTxErrorMessages";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

const STEP_COPY = {
  details: {
    title: { id: "app.admin.garden.create.step.details.title" },
    description: { id: "app.admin.garden.create.step.details.description" },
  },
  team: {
    title: { id: "app.admin.garden.create.step.team.title" },
    description: { id: "app.admin.garden.create.step.team.description" },
  },
  review: {
    title: { id: "app.admin.garden.create.step.review.title" },
    description: { id: "app.admin.garden.create.step.review.description" },
  },
} as const satisfies Record<
  CreateGardenStep["id"],
  { title: { id: string }; description: { id: string } }
>;

function hasGardenDraftContent(form: ReturnType<typeof useCreateGardenStore.getState>["form"]) {
  return (
    form.name.trim().length > 0 ||
    form.slug.trim().length > 0 ||
    form.description.trim().length > 0 ||
    form.location.trim().length > 0 ||
    form.bannerImage.trim().length > 0 ||
    form.metadata.trim().length > 0 ||
    form.openJoining ||
    form.domains.length > 0 ||
    form.gardeners.length > 0 ||
    form.stewards.length > 0
  );
}

export function useCreateGardenController() {
  const intl = useIntl();
  const navigate = useNavigate();
  const storeSteps = useCreateGardenStore((state) => state.steps);
  const steps = useMemo(
    () =>
      storeSteps.map((step) => ({
        ...step,
        title: intl.formatMessage(STEP_COPY[step.id].title),
        description: intl.formatMessage(STEP_COPY[step.id].description),
      })),
    [storeSteps, intl]
  );
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const form = useCreateGardenStore(useShallow((state) => state.form));
  const resetForm = useCreateGardenStore((state) => state.reset);
  const goToStep = useCreateGardenStore((state) => state.goToStep);
  const isOnline = useOnlineStatus();

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
    checkConfirmation,
    confirmWalletCancellation,
    recoveryKey,
    estimateCreationCost,
    draft,
  } = useCreateGardenWorkflow();
  const address = usePrimaryAddress() ?? undefined;
  const sender = useTransactionSender();
  const chainId = useAdminStore((adminState) => adminState.selectedChainId);
  const recordCreatedGarden = useAdminStore((adminState) => adminState.recordCreatedGarden);
  const { loadDraft, draftKey } = draft;

  const isPending = state.matches("pending") || state.matches("reconciling");
  const isSubmitting = state.matches("submitting") || isPending;
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";
  const txError = useTxErrorMessages(state.context.error);
  const initializedScopeRef = useRef<string | null>(null);
  const landedRef = useRef(false);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  useEffect(() => {
    if (!draftKey || initializedScopeRef.current === draftKey) return;
    initializedScopeRef.current = draftKey;

    let cancelled = false;

    const initializeFlow = async () => {
      openFlow();

      const storeState = useCreateGardenStore.getState();
      if (hasGardenDraftContent(storeState.form)) {
        const isOnReviewStep = storeState.currentStep === storeState.steps.length - 1;
        if (isOnReviewStep && storeState.isReviewReady()) {
          goToReview();
        }
        return;
      }

      const restoredDraft = await loadDraft();
      if (cancelled || !restoredDraft) return;
      const restored = useCreateGardenStore.getState();
      if (restored.currentStep === restored.steps.length - 1 && restored.isReviewReady())
        goToReview();
    };

    void initializeFlow();

    return () => {
      cancelled = true;
    };
  }, [openFlow, goToReview, loadDraft, draftKey]);

  useAsyncEffect(
    async ({ isMounted }) => {
      if (!isSuccess || landedRef.current) return;
      landedRef.current = true;

      const { form: createdForm } = useCreateGardenStore.getState();
      const plannedMemberCount = createdForm.gardeners.length + createdForm.stewards.length;
      toastService.success({
        title: intl.formatMessage({ id: "admin.garden.created.title" }),
        message: intl.formatMessage({ id: "admin.garden.created.message" }),
        context: "garden creation",
        suppressLogging: true,
      });
      if (plannedMemberCount > 0) {
        toastService.info({
          title: intl.formatMessage({ id: "app.admin.garden.create.teamAssignmentReminder.title" }),
          message: intl.formatMessage(
            { id: "app.admin.garden.create.teamAssignmentReminder.message" },
            { count: plannedMemberCount }
          ),
          context: "garden creation",
          suppressLogging: true,
        });
      }
      resetForm();

      // The receipt names the garden before the indexer can, so its creator lands on it.
      const gardenId = state.context.txHash
        ? await readCreatedGardenAddress(state.context.txHash as `0x${string}`, chainId)
        : null;
      const scopeKey = getAdminGardenScopeKey(address, chainId);
      if (gardenId && scopeKey) {
        recordCreatedGarden(scopeKey, { id: gardenId, name: createdForm.name.trim() });
      }
      if (isMounted()) navigate(gardenId ? adminRoutes.garden({ gardenId }) : adminRoutes.garden());
    },
    [isSuccess]
  );

  const formKey = JSON.stringify(form);
  const isReviewReady = useCreateGardenStore((storeState) => storeState.isReviewReady());
  const costEstimate = useQuery({
    queryKey: gardensKeys.creationEstimate(address, chainId, formKey),
    queryFn: estimateCreationCost,
    enabled: Boolean(address && sender) && isReviewReady && isOnline && !isSubmitting,
    staleTime: 30_000,
    retry: false,
  });
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
        message: intl.formatMessage({ id: "app.admin.garden.create.offline.message" }),
        context: "garden creation",
      });
      return;
    }

    const storeState = useCreateGardenStore.getState();
    if (storeState.hasUnaddedMember) {
      toastService.error({
        title: intl.formatMessage({ id: "app.admin.garden.create.unaddedMember.title" }),
        message: intl.formatMessage({ id: "app.admin.garden.create.unaddedMember.message" }),
        context: "garden creation",
      });
      return;
    }

    // A taken name would leave the garden without one. If the chain can't answer, the mint's own
    // check still stands and the name can follow, so the garden is not held back.
    const slugAvailable = await readSlugAvailability(storeState.form.slug.trim()).catch(() => true);
    if (!slugAvailable) {
      toastService.error({
        title: intl.formatMessage({ id: "app.garden.create.slugTaken" }),
        message: intl.formatMessage({ id: "app.admin.garden.create.slugTakenMessage" }),
        context: "garden creation",
      });
      return;
    }

    const started = submitCreation();
    if (!started) {
      toastService.error({
        title: intl.formatMessage({ id: "admin.garden.deploy.notReady.title" }),
        message: intl.formatMessage({ id: "admin.garden.deploy.notReady.message" }),
        context: "garden creation",
      });
    }
  };

  const discardDraft = () => {
    setDiscardPromptOpen(false);
    closeFlow();
    navigate(adminRoutes.garden());
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    if (hasGardenDraftContent(useCreateGardenStore.getState().form)) {
      setDiscardPromptOpen(true);
      return;
    }
    discardDraft();
  };

  const currentStepConfig = steps[currentStep];

  return {
    costEstimate: costEstimate.data,
    costEstimateFailed: costEstimate.isError,
    costEstimateLoading: costEstimate.isFetching,
    currentStep,
    discardDraft,
    discardPromptOpen,
    dismissDiscardPrompt: () => setDiscardPromptOpen(false),
    gasIsSponsored: sender?.supportsSponsorship ?? false,
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
    isPending,
    isCheckingConfirmation: state.matches("reconciling"),
    checkConfirmation,
    confirmWalletCancellation,
    recoveryKey,
    isTeamStep: currentStepConfig?.id === "team",
    retry,
    showValidation: stepValidation.showValidation,
    steps,
    txErrorView: txError.view,
  };
}
