import {
  type Action,
  DEFAULT_CHAIN_ID,
  findActionByUID,
  type Garden,
  getSafeMediaMetadata,
  getWorkMediaId,
  logger,
  mediaResourceManager,
  parseContractError,
  toastService,
  track,
  useActionTranslation,
  useAudioRecording,
  useDraftAutoSave,
  useDraftResume,
  useGardenTranslation,
  useJoinGarden,
  useOffline,
  useTimeout,
  useUser,
  useWorkFlowStore,
  useWorkFormContext,
  useWorkSelection,
  WorkTab,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { canProceedWithWorkSubmission } from "../../../modules/work/submission-flow";

type MediaSurface = "media" | "review";
type MediaJourneyEvent =
  | "work_media_preview_failed"
  | "work_media_removed"
  | "work_broken_media_removed";

interface UseWorkSubmissionFlowControllerOptions {
  homeRoute: string;
  profileRoute: string;
  trackMediaJourneyEvent: (event: MediaJourneyEvent, properties: Record<string, unknown>) => void;
}

export function useWorkSubmissionFlowController({
  homeRoute,
  profileRoute,
  trackMediaJourneyEvent,
}: UseWorkSubmissionFlowControllerOptions) {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = useWorkSelection();
  const form = useWorkFormContext();
  const { authMode } = useUser();
  const join = useJoinGarden();
  const submissionCompleted = useWorkFlowStore((state) => state.submissionCompleted);
  const workSubmissionJourneyId = useWorkFlowStore((state) => state.workSubmissionJourneyId);
  const ensureWorkSubmissionJourneyId = useWorkFlowStore(
    (state) => state.ensureWorkSubmissionJourneyId
  );
  const setGardenAddressStable = useWorkFlowStore((state) => state.setGardenAddress);
  const audioNotes = useWorkFlowStore((state) => state.audioNotes);
  const setAudioNotes = useWorkFlowStore((state) => state.setAudioNotes);
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const { set: scheduleNavigation } = useTimeout();
  const [brokenMediaIds, setBrokenMediaIds] = useState<Set<string>>(() => new Set());
  const brokenMediaIdsRef = useRef(brokenMediaIds);
  const mediaClickRef = useRef<(() => void) | null>(null);
  const cameraClickRef = useRef<(() => void) | null>(null);
  const {
    actions,
    gardens,
    joinableCommunityGarden,
    activeTab,
    setActiveTab,
    selectedDomain,
    actionUID,
    gardenAddress,
    setGardenAddress,
  } = selection;
  const { workMutation, images, setImages, feedback, timeSpentMinutes } = form;

  const audio = useAudioRecording({
    onRecordingComplete: (file) => {
      const current = useWorkFlowStore.getState().audioNotes;
      setAudioNotes([...current, file]);
      track(
        "audio_note_recorded",
        { duration: "unknown", noteIndex: current.length },
        { includeSessionId: false }
      );
    },
  });
  const { saveOnExit } = useDraftAutoSave(
    { gardenAddress, actionUID, feedback, timeSpentMinutes },
    images
  );
  const { showDraftDialog, handleContinueDraft, handleStartFresh, clearActiveDraft } =
    useDraftResume({
      formState: {
        images,
        gardenAddress,
        actionUID,
        feedback,
        timeSpentMinutes: timeSpentMinutes ?? 0,
      },
      isOnIntroTab: activeTab === WorkTab.Intro,
      searchParams,
      setSearchParams,
    });

  useEffect(() => {
    brokenMediaIdsRef.current = brokenMediaIds;
  }, [brokenMediaIds]);
  useEffect(() => {
    ensureWorkSubmissionJourneyId();
  }, [ensureWorkSubmissionJourneyId]);
  useEffect(() => {
    const state = location.state as { gardenId?: string } | null;
    if (state?.gardenId && gardens.length > 0) setGardenAddressStable(state.gardenId);
  }, [gardens.length, location.state, setGardenAddressStable]);
  useEffect(
    () => () => {
      mediaResourceManager.cleanupUrls("work-draft");
      mediaResourceManager.cleanupUrls("work-draft-video");
    },
    []
  );
  useEffect(() => {
    if (!submissionCompleted) return;
    clearActiveDraft().catch((error) => {
      logger.error("Failed to clear draft after submission", { error, source: "Garden" });
    });
    return scheduleNavigation(() => {
      navigate(homeRoute, { replace: true, viewTransition: true });
      requestAnimationFrame(() => {
        useWorkFlowStore.getState().reset();
        form.reset();
      });
    }, 800);
  }, [clearActiveDraft, form, homeRoute, navigate, scheduleNavigation, submissionCompleted]);

  const selectedAction = useMemo(
    () => (typeof actionUID === "number" ? findActionByUID(actions, actionUID) : null),
    [actionUID, actions]
  );
  const { translatedAction } = useActionTranslation(selectedAction);
  const selectedGarden = useMemo(
    () =>
      gardenAddress
        ? (gardens.find((garden) => garden.id === gardenAddress) ??
          (joinableCommunityGarden?.id === gardenAddress ? joinableCommunityGarden : null))
        : null,
    [gardenAddress, gardens, joinableCommunityGarden]
  );
  const { translatedGarden } = useGardenTranslation(selectedGarden);
  const mediaConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({ id: "app.garden.upload.title", defaultMessage: "Upload Media" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.media.instruction",
        defaultMessage: "Please take a clear photo of the plants in the garden",
      }),
      required: false,
      needed: [] as string[],
      optional: [] as string[],
      maxImageCount: 0,
      minImageCount: undefined as number | undefined,
    };
    if (!translatedAction?.mediaInfo) return defaults;
    const {
      needed = [],
      optional = [],
      maxImageCount = 0,
      minImageCount,
      ...rest
    } = translatedAction.mediaInfo;
    return {
      ...defaults,
      ...rest,
      needed: Array.isArray(needed) ? needed : [],
      optional: Array.isArray(optional) ? optional : [],
      maxImageCount,
      minImageCount,
    };
  }, [intl, translatedAction]);
  const minRequired = mediaConfig.required ? (mediaConfig.minImageCount ?? 1) : 0;
  const detailsConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({
        id: "app.garden.details.title",
        defaultMessage: "Enter Details",
      }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.details.instruction",
        defaultMessage: "Provide detailed information and feedback",
      }),
      feedbackPlaceholder: intl.formatMessage({
        id: "app.garden.details.feedbackPlaceholder",
        defaultMessage: "Provide feedback or any observations",
      }),
    };
    return translatedAction?.details ? { ...defaults, ...translatedAction.details } : defaults;
  }, [intl, translatedAction]);
  const reviewConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.review.instruction",
        defaultMessage: "Check if the information is correct",
      }),
    };
    return translatedAction?.review ? { ...defaults, ...translatedAction.review } : defaults;
  }, [intl, translatedAction]);
  const detailInputs = useMemo(() => translatedAction?.inputs ?? [], [translatedAction]);
  const reviewData = useMemo(() => {
    const garden: Garden = translatedGarden || {
      id: gardenAddress || "",
      chainId: DEFAULT_CHAIN_ID,
      tokenAddress: "",
      tokenID: 0n,
      name: intl.formatMessage({ id: "app.garden.unknown", defaultMessage: "Unknown Garden" }),
      description: "",
      location: "",
      bannerImage: "",
      gardeners: [],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    };
    const action: Action = translatedAction || {
      id: `${DEFAULT_CHAIN_ID}-${actionUID ?? 0}`,
      slug: "",
      domain: selectedDomain,
      startTime: Date.now(),
      endTime: Date.now(),
      title: intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected Action" }),
      instructions: "",
      capitals: [],
      media: ["/images/no-image-placeholder.png"],
      createdAt: Date.now(),
      description: "",
      inputs: detailInputs,
      mediaInfo: mediaConfig,
      details: detailsConfig,
      review: reviewConfig,
    };
    return { action, garden };
  }, [
    actionUID,
    detailInputs,
    detailsConfig,
    gardenAddress,
    intl,
    mediaConfig,
    reviewConfig,
    selectedDomain,
    translatedAction,
    translatedGarden,
  ]);

  const markMediaPreviewFailed = useCallback(
    (file: File, surface: MediaSurface) => {
      const mediaId = getWorkMediaId(file);
      if (brokenMediaIdsRef.current.has(mediaId)) return;
      const journeyId = ensureWorkSubmissionJourneyId();
      setBrokenMediaIds((previous) => {
        const next = new Set(previous).add(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });
      trackMediaJourneyEvent("work_media_preview_failed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        parsed_error_family: "preview_failed",
        broken_count: brokenMediaIdsRef.current.size,
        ...getSafeMediaMetadata(file),
      });
    },
    [actionUID, authMode, ensureWorkSubmissionJourneyId, trackMediaJourneyEvent]
  );
  const removeMedia = useCallback(
    (file: File, surface: MediaSurface) => {
      const mediaId = getWorkMediaId(file);
      const journeyId = ensureWorkSubmissionJourneyId();
      setImages((previous) => previous.filter((item) => getWorkMediaId(item) !== mediaId));
      setBrokenMediaIds((previous) => {
        if (!previous.has(mediaId)) return previous;
        const next = new Set(previous);
        next.delete(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });
      trackMediaJourneyEvent("work_media_removed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        file_count: 1,
        broken_count: brokenMediaIdsRef.current.size,
        ...getSafeMediaMetadata(file),
      });
    },
    [actionUID, authMode, ensureWorkSubmissionJourneyId, setImages, trackMediaJourneyEvent]
  );
  const removeBrokenMedia = useCallback(
    (surface: MediaSurface) => {
      const ids = new Set(brokenMediaIdsRef.current);
      if (ids.size === 0) return;
      const journeyId = ensureWorkSubmissionJourneyId();
      setImages((previous) => previous.filter((file) => !ids.has(getWorkMediaId(file))));
      setBrokenMediaIds(new Set());
      brokenMediaIdsRef.current = new Set();
      trackMediaJourneyEvent("work_broken_media_removed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        file_count: ids.size,
        broken_count: ids.size,
      });
    },
    [actionUID, authMode, ensureWorkSubmissionJourneyId, setImages, trackMediaJourneyEvent]
  );
  const joinCommunityGarden = useCallback(async () => {
    if (!joinableCommunityGarden?.id) return;
    try {
      const result = await join.joinGarden(joinableCommunityGarden.id);
      if (result === "already-joining") return;
      setGardenAddress(joinableCommunityGarden.id);
      toastService.success({
        title:
          result === "already-member"
            ? intl.formatMessage({
                id: "app.garden.alreadyMember",
                defaultMessage: "You're already a member of this garden",
              })
            : intl.formatMessage({
                id: "app.garden.joinSuccess",
                defaultMessage: "Successfully joined garden",
              }),
      });
    } catch (error) {
      logger.error("Community Garden join failed", {
        error,
        source: "GardenFlow",
        gardenAddress: joinableCommunityGarden.id,
      });
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.joinError",
          defaultMessage: "Failed to join garden",
        }),
        message: intl.formatMessage({
          id: "app.garden.communityOnramp.errorMessage",
          defaultMessage: "Try again here, or open Profile to join from your garden list.",
        }),
        action: {
          label: intl.formatMessage({ id: "app.profile", defaultMessage: "Profile" }),
          onClick: () => navigate(profileRoute),
          dismissOnClick: true,
        },
      });
    }
  }, [intl, join, joinableCommunityGarden, navigate, profileRoute, setGardenAddress]);

  const changeTab = (tab: WorkTab) => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    setActiveTab(tab);
  };
  const submit = async () => {
    if (!gardenAddress || actionUID === null || !findActionByUID(actions, actionUID)) return false;
    try {
      return Boolean(await form.uploadWork());
    } catch (error) {
      logger.error("Work submission failed", { error, source: "GardenFlow" });
      return false;
    }
  };
  const isWalletRequestExpired = useMemo(() => {
    if (activeTab !== WorkTab.Review || !workMutation.error) return false;
    const original =
      workMutation.error instanceof Error && workMutation.error.cause instanceof Error
        ? workMutation.error.cause
        : workMutation.error;
    return parseContractError(original).name === "WalletRequestExpired";
  }, [activeTab, workMutation.error]);
  const queueStatusMessage = useMemo(() => {
    if (activeTab !== WorkTab.Review) return null;
    if (!isOnline) {
      return intl.formatMessage({
        id: "app.offline.status.went.offline",
        defaultMessage: "You're offline. Your work will sync when you're back online.",
      });
    }
    if (syncStatus === "syncing" || workMutation.isPending) {
      return intl.formatMessage(
        { id: "app.syncBar.syncing", defaultMessage: "Syncing {count} items..." },
        { count: Math.max(pendingCount, 1) }
      );
    }
    return pendingCount > 0
      ? intl.formatMessage(
          { id: "app.syncBar.pendingOnline", defaultMessage: "{count} items waiting to sync" },
          { count: pendingCount }
        )
      : null;
  }, [activeTab, intl, isOnline, pendingCount, syncStatus, workMutation.isPending]);
  const canProceed = canProceedWithWorkSubmission({
    tab: activeTab,
    gardenAddress,
    actionUID,
    imageCount: images.length,
    minRequired,
    isValid: form.state.isValid,
    isSubmitting: form.state.isSubmitting,
    isMutationPending: workMutation.isPending,
    bypassMediaRequirement: import.meta.env.VITE_DEBUG_MODE === "true",
  });

  return {
    ...selection,
    ...form,
    audioNotes,
    brokenMediaIds,
    cameraClickRef,
    canProceed,
    changeTab,
    detailsConfig,
    detailInputs,
    draft: {
      showDraftDialog,
      handleContinueDraft,
      startFresh: async () => {
        await handleStartFresh();
        setBrokenMediaIds(new Set());
        useWorkFlowStore.getState().reset();
        form.reset();
      },
    },
    exit: async () => {
      await saveOnExit();
      navigate(homeRoute, { viewTransition: true });
    },
    isJoiningCommunityGarden:
      join.isJoining &&
      (!join.joiningGardenId || join.joiningGardenId === joinableCommunityGarden?.id),
    isRecording: audio.isRecording,
    isWalletRequestExpired,
    joinCommunityGarden,
    markMediaPreviewFailed,
    mediaClickRef,
    mediaConfig,
    minRequired,
    queueStatusMessage,
    recordingElapsed: audio.elapsed,
    removeBrokenMedia,
    removeMedia,
    reviewConfig,
    reviewData,
    setAudioNotes,
    showSkeleton: selection.isLoading && actions.length === 0 && gardens.length === 0,
    submissionCompleted,
    submit,
    toggleAudioRecording: audio.toggle,
    workSubmissionJourneyId,
    ensureWorkSubmissionJourneyId,
    authMode,
  };
}
