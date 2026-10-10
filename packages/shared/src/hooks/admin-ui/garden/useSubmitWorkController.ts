import { connectivityStore } from "../../../stores/connectivity";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { toastService, validationToasts } from "../../../components/toast";
import { isOfflineTxHash } from "../../../modules/job-queue/queue-policy";
import { logger } from "../../../modules/app/logger";
import { isWorkPhoto } from "../../../modules/work/work-attachments";
import { validateWorkSubmissionContext } from "../../../modules/work/work-submission";
import type { AuthStateValue } from "../../../providers/Auth";
import type { Action, Address, Domain } from "../../../types/domain";
import { findActionByUID, parseActionUID } from "../../../utils/action/parsers";
import { compareAddresses } from "../../../utils/blockchain/address";
import { expandDomainMask } from "../../../utils/domain";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useBeforeUnloadWhilePending } from "../../utils/useBeforeUnloadWhilePending";
import { useStepFocus } from "../../utils/useStepFocus";
import { useWorkForm } from "../../work/useWorkForm";
import { useWorkMutation } from "../../work/useWorkMutation";
import { useSubmitWorkMediaController } from "./useSubmitWorkMediaController";

export type SubmitWorkAuthSnapshot = Pick<AuthStateValue, "authMode" | "isAuthenticated"> & {
  primaryAddress: Address | null | undefined;
};

export type SubmitWorkStepId = "action" | "media" | "details" | "review";

const SUBMIT_WORK_STEP_IDS: SubmitWorkStepId[] = ["action", "media", "details", "review"];

export function getMinRequiredWorkImages(action: Action | null) {
  if (!action?.mediaInfo?.required) return 0;
  return action.mediaInfo.minImageCount ?? 1;
}

function browserIsOffline() {
  return !connectivityStore.getSnapshot();
}

interface UseSubmitWorkControllerOptions {
  auth: SubmitWorkAuthSnapshot;
  localizeAction: (action: Action, intl: Pick<IntlShape, "formatMessage" | "locale">) => Action;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  isOffline?: () => boolean;
}

export function useSubmitWorkController({
  auth,
  localizeAction,
  onDirtyChange,
  onBusyChange,
  isOffline = browserIsOffline,
}: UseSubmitWorkControllerOptions) {
  const { formatMessage, locale } = useIntl();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { data: actions = [], isLoading: actionsLoading } = useActions();
  const { authMode, isAuthenticated, primaryAddress } = auth;
  const { canManageGarden } = useGardenPermissions();
  const garden = useMemo(
    () => gardens.find((candidate) => compareAddresses(candidate.id, gardenId)),
    [gardens, gardenId]
  );
  const gardenDomains = useMemo<Set<Domain>>(
    () => new Set(garden?.domainMask ? expandDomainMask(garden.domainMask) : []),
    [garden?.domainMask]
  );
  const availableActions = useMemo(
    () =>
      actions.filter(
        (action): action is Action & { domain: Domain } =>
          action.domain !== null && gardenDomains.has(action.domain)
      ),
    [actions, gardenDomains]
  );
  const [actionDomain, setActionDomain] = useState<Domain | "all">("all");
  const chooserDomains = useMemo(
    () =>
      Array.from(new Set(availableActions.map((action) => action.domain))).sort((a, b) => a - b),
    [availableActions]
  );
  const effectiveDomain =
    actionDomain !== "all" && chooserDomains.includes(actionDomain) ? actionDomain : "all";
  const visibleActions = useMemo(
    () =>
      effectiveDomain === "all"
        ? availableActions
        : availableActions.filter((action) => action.domain === effectiveDomain),
    [availableActions, effectiveDomain]
  );

  const [selectedActionId, setSelectedActionId] = useState("");
  const selectedAction = useMemo<Action | null>(() => {
    if (!selectedActionId) return null;
    const action = findActionByUID(actions, parseActionUID(selectedActionId));
    return action ? localizeAction(action, { formatMessage, locale }) : null;
  }, [actions, formatMessage, locale, localizeAction, selectedActionId]);
  const selectedActionUID = useMemo(
    () => (selectedAction ? parseActionUID(selectedAction.id) : null),
    [selectedAction]
  );

  const form = useWorkForm(selectedAction?.inputs);
  const media = useSubmitWorkMediaController(selectedActionId, formatMessage);
  const {
    handleFilesChange,
    images,
    isPreparingMedia,
    mediaFeedback,
    removeImage,
    resetMedia,
    setMediaFeedback,
    setProgressMessage,
    progressMessage,
  } = media;
  const submitIntentRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(1);
  // Details shows every field's error once Next has been pressed there, until the step changes.
  const [showValidation, setShowValidation] = useState(false);
  useEffect(() => setShowValidation(false), [currentStep]);

  const canSubmit = garden ? canManageGarden(garden) : false;
  const isLoadingData = Boolean(gardensLoading || actionsLoading);
  const mutation = useWorkMutation({
    authMode,
    gardenAddress: garden?.id ? (garden.id as Address) : null,
    actionUID: selectedActionUID,
    actions,
    userAddress: primaryAddress ?? null,
    completeClientFlow: false,
    allowOfflineQueue: false,
    retainSubmission: true,
    onProgress: (stage, message) => {
      setProgressMessage(
        formatMessage({ id: `app.admin.work.submit.progress.${stage}`, defaultMessage: message })
      );
    },
    // A sent submission stays on its Review, which says so in place (DL-080):
    // no toast repeats it and nothing closes the flow. Only a queued stand-in,
    // which the admin never treats as sent, still needs a word here.
    onSuccess: (txHash) => {
      if (
        typeof txHash === "string" &&
        isOfflineTxHash(txHash) &&
        mutation.getLastSubmissionOutcome()?.kind !== "awaiting-confirmation"
      ) {
        toastService.error({
          title: formatMessage({ id: "app.admin.work.submit.queuedError.title" }),
          message: formatMessage({ id: "app.admin.work.submit.queuedError.message" }),
          context: "admin work submission",
        });
      }
    },
    onError: (error: unknown) => {
      logger.error("Admin work submission failed", { error });
    },
    onSettled: () => setProgressMessage(""),
  });

  const busy = mutation.isPending || isPreparingMedia;
  // The send landed as a real transaction, and the mutation published it to this
  // session. It publishes nothing for a send that finishes after the account
  // changed, so that one never reads as sent here. From here the Review is a
  // record of what went out: nothing in it changes and closing loses nothing.
  const published = mutation.lastSubmissionOutcome;
  const sent =
    mutation.isSuccess &&
    published !== null &&
    (published.kind === "direct" || published.kind === "processed") &&
    published.txHash === mutation.data &&
    !isOfflineTxHash(published.txHash);
  const submitted = sent || published?.kind === "awaiting-confirmation";
  const panelDirty = !submitted && (form.formState.isDirty || images.length > 0);
  useEffect(() => {
    onDirtyChange?.(panelDirty);
    return () => onDirtyChange?.(false);
  }, [onDirtyChange, panelDirty]);
  useBeforeUnloadWhilePending(busy);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!selectedActionId && availableActions.length === 1) {
      setSelectedActionId(availableActions[0].id);
      setCurrentStep((step) => (step === 1 ? 2 : step));
    }
  }, [availableActions, selectedActionId]);

  const phaseRef = useStepFocus<HTMLDivElement>(currentStep);
  const activeStepId = SUBMIT_WORK_STEP_IDS[currentStep - 1] ?? "action";

  const submitValidatedDraft = form.handleSubmit((data) => {
    if (!garden || !selectedAction || selectedActionUID === null) return;

    const validationErrors = validateWorkSubmissionContext(
      garden.id as Address,
      selectedActionUID,
      images,
      { minRequired: getMinRequiredWorkImages(selectedAction) }
    );
    if (validationErrors.length > 0) {
      validationToasts.formError(validationErrors[0]);
      return;
    }
    if (isOffline()) {
      toastService.error({
        title: formatMessage({ id: "app.admin.garden.create.offline.title" }),
        message: formatMessage({
          id: "app.admin.work.submit.offline.message",
          defaultMessage: "Reconnect to the internet before submitting work.",
        }),
        context: "admin work submission",
      });
      return;
    }

    setMediaFeedback(null);
    const { feedback, timeSpentMinutes, ...details } = data as Record<string, unknown>;
    const draft = {
      actionUID: selectedActionUID,
      // No placeholder: the submission falls back to its own title when this is empty.
      title: findActionByUID(actions, selectedActionUID)?.title ?? "",
      timeSpentMinutes: typeof timeSpentMinutes === "number" ? timeSpentMinutes : 0,
      feedback: typeof feedback === "string" ? feedback : "",
      media: images,
      details: details as Record<string, unknown>,
    };

    setProgressMessage(formatMessage({ id: "app.admin.work.submit.progress.validating" }));
    mutation.mutate({ draft, images: images.slice() });
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!submitIntentRef.current) {
      event.preventDefault();
      return;
    }
    submitIntentRef.current = false;
    void submitValidatedDraft(event);
  };

  const handleActionChange = (actionId: string) => {
    setSelectedActionId(actionId);
    form.reset();
    resetMedia();
    mutation.reset();
  };

  const handleSelectAction = (actionId: string) => {
    if (actionId && actionId !== selectedActionId) handleActionChange(actionId);
  };

  // Start a new submission from the done state: nothing chosen, nothing staged.
  const submitAnother = () => {
    handleActionChange("");
    setCurrentStep(1);
  };

  const goBack = () => {
    if (!busy && !submitted) setCurrentStep((step) => Math.max(1, step - 1));
  };
  const goNext = async () => {
    if (busy) return;
    if (activeStepId === "media") {
      const minRequired = getMinRequiredWorkImages(selectedAction);
      // Photos, not every staged file: a video is kept but does not count, and
      // the submission would refuse the work at the end for the same shortfall.
      const photoCount = images.filter((file) => isWorkPhoto(file)).length;
      if (minRequired > 0 && photoCount < minRequired) {
        setMediaFeedback({
          variant: "error",
          message: formatMessage(
            {
              id: "app.admin.work.submit.mediaRequiredError",
              defaultMessage:
                "{count, plural, one {Add at least # photo to continue.} other {Add at least # photos to continue.}}",
            },
            { count: minRequired }
          ),
        });
        return;
      }
    }
    if (activeStepId === "details") {
      setShowValidation(true);
      if (!(await form.trigger(undefined, { shouldFocus: true }))) return;
    }
    setCurrentStep((step) => Math.min(SUBMIT_WORK_STEP_IDS.length, step + 1));
  };
  const handleStepJump = (step: number) => {
    if (!busy && !submitted && step < currentStep) setCurrentStep(step);
  };
  const goToStep = (step: number) => {
    if (!busy && !submitted) setCurrentStep(step);
  };

  return {
    actions,
    activeStepId,
    availableActions,
    busy,
    canSubmit,
    chooserDomains,
    currentStep,
    effectiveDomain,
    form,
    garden,
    goBack,
    goNext,
    goToStep,
    handleActionChange,
    handleFilesChange,
    handleFormSubmit,
    handleSelectAction,
    handleStepJump,
    images,
    isAuthenticated,
    isLoadingData,
    isPreparingMedia,
    mediaFeedback,
    mutation,
    phaseRef,
    progressMessage,
    removeImage,
    selectDomain: setActionDomain,
    selectedAction,
    selectedActionId,
    sent,
    showValidation,
    submitAnother,
    armSubmitIntent: () => {
      submitIntentRef.current = true;
    },
    visibleActions,
  };
}

export type SubmitWorkController = ReturnType<typeof useSubmitWorkController>;
