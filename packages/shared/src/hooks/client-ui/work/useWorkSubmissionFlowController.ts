import {
  findActionByUID,
  logger,
  parseContractError,
  toastService,
  track,
  useAudioRecording,
  useDraftAutoSave,
  useDraftResume,
  useJoinGarden,
  useOffline,
  useTimeout,
  useUser,
  useWorkFlowStore,
  useWorkFormContext,
  useWorkSelection,
  WorkTab,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { canProceedWithWorkSubmission } from "../../../modules/work/submission-flow";
import { useWorkMediaLifecycle } from "./useWorkMediaLifecycle";
import { useWorkSubmissionPresentationModel } from "./useWorkSubmissionPresentationModel";

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
    ensureWorkSubmissionJourneyId();
  }, [ensureWorkSubmissionJourneyId]);
  useEffect(() => {
    const state = location.state as { gardenId?: string } | null;
    if (state?.gardenId && gardens.length > 0) setGardenAddressStable(state.gardenId);
  }, [gardens.length, location.state, setGardenAddressStable]);
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

  const { detailInputs, detailsConfig, mediaConfig, minRequired, reviewConfig, reviewData } =
    useWorkSubmissionPresentationModel({
      actions,
      gardens,
      joinableCommunityGarden,
      actionUID,
      gardenAddress,
      selectedDomain,
    });
  const media = useWorkMediaLifecycle({
    actionUID,
    authMode,
    ensureJourneyId: ensureWorkSubmissionJourneyId,
    setImages,
    trackEvent: trackMediaJourneyEvent,
  });
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
    brokenMediaIds: media.brokenMediaIds,
    cameraClickRef: media.cameraClickRef,
    canProceed,
    changeTab,
    detailsConfig,
    detailInputs,
    draft: {
      showDraftDialog,
      handleContinueDraft,
      startFresh: async () => {
        await handleStartFresh();
        media.resetBrokenMedia();
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
    markMediaPreviewFailed: media.markMediaPreviewFailed,
    mediaClickRef: media.mediaClickRef,
    mediaConfig,
    minRequired,
    queueStatusMessage,
    recordingElapsed: audio.elapsed,
    removeBrokenMedia: media.removeBrokenMedia,
    removeMedia: media.removeMedia,
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
