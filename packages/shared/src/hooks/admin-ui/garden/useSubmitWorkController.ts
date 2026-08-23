import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { toastService, validationToasts } from "../../../components/toast";
import { isOfflineTxHash } from "../../../modules/job-queue/queue-policy";
import { logger } from "../../../modules/app/logger";
import { normalizeWorkMediaFiles } from "../../../modules/work/media-processing";
import { validateWorkSubmissionContext } from "../../../modules/work/work-submission";
import type { AuthStateValue } from "../../../providers/Auth";
import type { Action, Address, Domain } from "../../../types/domain";
import { findActionByUID, getActionTitle, parseActionUID } from "../../../utils/action/parsers";
import { compareAddresses } from "../../../utils/blockchain/address";
import { expandDomainMask } from "../../../utils/domain";
import { imageCompressor } from "../../../utils/work/image-compression";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useBeforeUnloadWhilePending } from "../../utils/useBeforeUnloadWhilePending";
import { useStepFocus } from "../../utils/useStepFocus";
import { useWorkForm } from "../../work/useWorkForm";
import { useWorkMutation } from "../../work/useWorkMutation";

export type SubmitWorkAuthSnapshot = Pick<AuthStateValue, "authMode" | "isAuthenticated"> & {
  primaryAddress: Address | null | undefined;
};

export type SubmitWorkMediaFeedback = {
  variant: "warning" | "error";
  message: string;
};

export type SubmitWorkStepId = "action" | "media" | "details" | "review";

export const SUBMIT_WORK_STEP_IDS: SubmitWorkStepId[] = ["action", "media", "details", "review"];

const ADMIN_WORK_MEDIA_COMPRESSION_THRESHOLD_KB = 1024;
const ADMIN_WORK_MEDIA_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 2048,
  initialQuality: 0.8,
  useWebWorker: true,
} as const;

export function getMinRequiredWorkImages(action: Action | null) {
  if (!action?.mediaInfo?.required) return 0;
  return action.mediaInfo.minImageCount ?? 1;
}

async function compressAdminWorkMediaFiles(
  files: File[],
  onProgress: (progress: number) => void
): Promise<File[]> {
  const filesToCompress = files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) =>
      imageCompressor.shouldCompress(file, ADMIN_WORK_MEDIA_COMPRESSION_THRESHOLD_KB)
    );

  if (filesToCompress.length === 0) return files;

  const compressed = await imageCompressor.compressImages(
    filesToCompress.map(({ file }) => file),
    ADMIN_WORK_MEDIA_COMPRESSION_OPTIONS,
    onProgress
  );

  const preparedFiles = files.slice();
  compressed.forEach((result, compressedIndex) => {
    const originalIndex = filesToCompress[compressedIndex]?.index;
    if (originalIndex !== undefined) preparedFiles[originalIndex] = result.file;
  });

  return preparedFiles;
}

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

interface UseSubmitWorkControllerOptions {
  auth: SubmitWorkAuthSnapshot;
  localizeAction: (action: Action, intl: Pick<IntlShape, "formatMessage" | "locale">) => Action;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  isOffline?: () => boolean;
}

export function useSubmitWorkController({
  auth,
  localizeAction,
  onSuccess,
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
  const selectedActionIdRef = useRef(selectedActionId);
  selectedActionIdRef.current = selectedActionId;
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
  const [images, setImages] = useState<File[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [mediaFeedback, setMediaFeedback] = useState<SubmitWorkMediaFeedback | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const submitIntentRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(1);

  const panelDirty = form.formState.isDirty || images.length > 0;
  useEffect(() => {
    onDirtyChange?.(panelDirty);
    return () => onDirtyChange?.(false);
  }, [onDirtyChange, panelDirty]);

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
    onProgress: (stage, message) => {
      setProgressMessage(
        formatMessage({ id: `app.admin.work.submit.progress.${stage}`, defaultMessage: message })
      );
    },
    onSuccess: (txHash) => {
      if (typeof txHash === "string" && isOfflineTxHash(txHash)) {
        toastService.error({
          title: formatMessage({ id: "app.admin.work.submit.queuedError.title" }),
          message: formatMessage({ id: "app.admin.work.submit.queuedError.message" }),
          context: "admin work submission",
        });
        return;
      }

      toastService.success({ title: formatMessage({ id: "app.admin.work.submit.success" }) });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error("Admin work submission failed", { error });
    },
    onSettled: () => setProgressMessage(""),
  });

  const busy = mutation.isPending || isPreparingMedia;
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
      title: getActionTitle(actions, selectedActionUID),
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
    setImages([]);
    setMediaFeedback(null);
    setProgressMessage("");
    mutation.reset();
  };

  const handleSelectAction = (actionId: string) => {
    if (actionId && actionId !== selectedActionId) handleActionChange(actionId);
  };

  const handleFilesChange = useCallback(
    async (newFiles: File[]) => {
      setMediaFeedback(null);
      if (newFiles.length === 0) return;

      const actionIdAtStart = selectedActionIdRef.current;
      const isCurrentAction = () => selectedActionIdRef.current === actionIdAtStart;
      setIsPreparingMedia(true);
      setProgressMessage(formatMessage({ id: "admin.fileUpload.processing" }, { progress: 0 }));

      try {
        const normalized = await normalizeWorkMediaFiles(newFiles, {
          onHeicConversionStarted: () =>
            setProgressMessage(formatMessage({ id: "app.garden.upload.convertingHeic" })),
        });
        if (!isCurrentAction()) return;

        const acceptedFiles = normalized.accepted.map((item) => item.file);
        if (acceptedFiles.length > 0) {
          const preparedFiles = await compressAdminWorkMediaFiles(acceptedFiles, (progress) => {
            setProgressMessage(
              formatMessage(
                { id: "admin.fileUpload.processing", defaultMessage: "Processing... {progress}%" },
                { progress: Math.round(progress) }
              )
            );
          });
          if (!isCurrentAction()) return;
          setImages((previous) => [...previous, ...preparedFiles]);
        }

        const unsupportedCount = normalized.rejected.filter(
          (item) => item.reason === "unsupported"
        ).length;
        const conversionFailureCount = normalized.rejected.filter(
          (item) => item.reason === "heic_conversion_failed"
        ).length;
        const messages: string[] = [];

        if (unsupportedCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.unsupportedMediaMessage",
              defaultMessage:
                "{count, plural, one {That file is not a supported photo or video.} other {# files are not supported photos or videos.}}",
            },
            { count: unsupportedCount }
          );
          messages.push(message);
          toastService.info({
            title: formatMessage({
              id: "app.garden.upload.unsupportedMediaTitle",
              defaultMessage: "Some files were not added",
            }),
            message,
            context: "admin media upload",
          });
        }

        if (conversionFailureCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.conversionFailedMessage",
              defaultMessage:
                "{count, plural, one {Try that photo again or choose a different image.} other {Try those photos again or choose different images.}}",
            },
            { count: conversionFailureCount }
          );
          messages.push(message);
          toastService.error({
            title: formatMessage({
              id: "app.garden.upload.conversionFailedTitle",
              defaultMessage: "HEIC photo could not be converted",
            }),
            message,
            context: "admin media upload",
          });
        }

        if (messages.length > 0) {
          setMediaFeedback({
            variant: conversionFailureCount > 0 ? "error" : "warning",
            message: messages.join(" "),
          });
        }
      } catch (error) {
        logger.error("Admin media processing failed", { error });
        const message = formatMessage({
          id: "app.garden.upload.compressionFailedMessage",
          defaultMessage: "Try fewer or smaller images, or check your connection.",
        });
        setMediaFeedback({ variant: "error", message });
        toastService.error({
          title: formatMessage({
            id: "app.garden.upload.compressionFailedTitle",
            defaultMessage: "Couldn't process those images",
          }),
          message,
          context: "admin media upload",
          error,
        });
      } finally {
        setIsPreparingMedia(false);
        setProgressMessage("");
      }
    },
    [formatMessage]
  );

  const goBack = () => {
    if (!busy) setCurrentStep((step) => Math.max(1, step - 1));
  };
  const goNext = async () => {
    if (busy) return;
    if (activeStepId === "media") {
      const minRequired = getMinRequiredWorkImages(selectedAction);
      if (minRequired > 0 && images.length < minRequired) {
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
    if (activeStepId === "details" && !(await form.trigger())) return;
    setCurrentStep((step) => Math.min(SUBMIT_WORK_STEP_IDS.length, step + 1));
  };
  const handleStepJump = (step: number) => {
    if (!busy && step < currentStep) setCurrentStep(step);
  };
  const goToStep = (step: number) => {
    if (!busy) setCurrentStep(step);
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
    mediaFeedback,
    mutation,
    phaseRef,
    progressMessage,
    removeImage: (index: number) =>
      setImages((previous) => previous.filter((_, imageIndex) => imageIndex !== index)),
    resetMutation: mutation.reset,
    selectDomain: setActionDomain,
    selectedAction,
    selectedActionId,
    submitValidatedDraft,
    armSubmitIntent: () => {
      submitIntentRef.current = true;
    },
    visibleActions,
  };
}

export type SubmitWorkController = ReturnType<typeof useSubmitWorkController>;
