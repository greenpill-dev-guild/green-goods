import { useWorkDraftRetirement } from "../../work/useWorkDraftRetirement";
import { useUIStore } from "../../../stores/useUIStore";
import { roundWorkLocation } from "../../../modules/work/work-attachments";
import type { Address } from "../../../types/domain";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toastService } from "../../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { logger } from "../../../modules/app/logger";
import {
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  type WorkLinkIntent,
  workLinkReturnGarden,
  writeWorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import { canProceedWithWorkSubmission } from "../../../modules/work/submission-flow";
import { useWorkFormContext, useWorkSelection } from "../../../providers/Work";
import { useShareTargetIntake } from "./useShareTargetIntake";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import { WorkTab } from "../../../stores/workFlowTypes";
import { findActionByUID } from "../../../utils/action/parsers";
import { parseContractError } from "../../../utils/errors/contract-errors";
import { useOffline } from "../../app/useOffline";
import { useUser } from "../../auth/useUser";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useWorkLinkChoices } from "../../commitment-pooling/useWorkLinkChoices";
import { useJoinGarden } from "../../garden/useJoinGarden";
import { useWorkAudioRecording } from "../../work/useWorkAudioRecording";
import { useTimeout } from "../../utils/useTimeout";
import { useDraftAutoSave, useDraftSaveStatus } from "../../work/useDraftAutoSave";
import { useDraftResume } from "../../work/useDraftResume";
import { useWorkMediaLifecycle } from "./useWorkMediaLifecycle";
import { useWorkSubmissionPresentationModel } from "./useWorkSubmissionPresentationModel";

type MediaJourneyEvent =
  | "work_media_preview_failed"
  | "work_media_removed"
  | "work_broken_media_removed";
type LinkIntentStatus = "none" | "validating" | "valid" | "invalid" | "unavailable";

interface PendingLinkRecovery {
  intent: WorkLinkIntent;
  payload: {
    clientOperationId: string;
    commitmentId: bigint;
    clientWorkId: string;
    sourceWorkJobId?: string;
    requirementIndex: number;
    gardenAddress: `0x${string}`;
  };
  error: unknown;
}

function sameLinkIdentity(left: WorkLinkIntent, right: WorkLinkIntent): boolean {
  return (
    left.commitmentId === right.commitmentId &&
    left.requirementIndex === right.requirementIndex &&
    left.actionUID === right.actionUID &&
    left.garden.toLowerCase() === right.garden.toLowerCase()
  );
}

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
  const { authMode, primaryAddress } = useUser();
  const join = useJoinGarden();
  const submissionCompleted = useWorkFlowStore((state) => state.submissionCompleted);
  const workSubmissionJourneyId = useWorkFlowStore((state) => state.workSubmissionJourneyId);
  const ensureWorkSubmissionJourneyId = useWorkFlowStore(
    (state) => state.ensureWorkSubmissionJourneyId
  );
  const setGardenAddressStable = useWorkFlowStore((state) => state.setGardenAddress);
  const tags = useWorkFlowStore((state) => state.tags);
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
  const { workMutation, images, setImages, setValue, feedback, timeSpentMinutes } = form;
  const {
    feedback: _feedback,
    timeSpentMinutes: _timeSpentMinutes,
    location: formLocation,
    ...details
  } = form.values;
  const commitmentJobs = useCommitmentJobs({ chainId: DEFAULT_CHAIN_ID });
  const parsedLinkIntent = useMemo(() => parseWorkLinkIntent(searchParams), [searchParams]);
  const hasLinkIntentParams = useMemo(() => hasWorkLinkIntentParams(searchParams), [searchParams]);
  const [pendingLinkRecovery, setPendingLinkRecovery] = useState<PendingLinkRecovery | null>(null);
  const [isSchedulingDependentLink, setIsSchedulingDependentLink] = useState(false);
  const [linkSchedulingSucceeded, setLinkSchedulingSucceeded] = useState(false);
  const linkChoices = useWorkLinkChoices({
    chainId: DEFAULT_CHAIN_ID,
    account: primaryAddress as `0x${string}` | null,
    workGarden: (parsedLinkIntent?.garden ?? gardenAddress) as `0x${string}` | null,
    returnGarden: (parsedLinkIntent ? workLinkReturnGarden(parsedLinkIntent) : gardenAddress) as
      | `0x${string}`
      | null,
    actionUID: parsedLinkIntent?.actionUID ?? actionUID,
  });
  const linkIntent = useMemo(
    () =>
      parsedLinkIntent
        ? (linkChoices.choices.find((choice) => sameLinkIdentity(choice, parsedLinkIntent)) ?? null)
        : null,
    [linkChoices.choices, parsedLinkIntent]
  );
  const linkIntentStatus: LinkIntentStatus = !hasLinkIntentParams
    ? "none"
    : !parsedLinkIntent
      ? "invalid"
      : !primaryAddress || linkChoices.isLoading
        ? "validating"
        : linkChoices.isError
          ? "unavailable"
          : linkIntent
            ? "valid"
            : "invalid";
  const clearLinkIntent = useCallback(
    () => setSearchParams(writeWorkLinkIntent(searchParams, null), { replace: true }),
    [searchParams, setSearchParams]
  );
  const selectLinkIntent = useCallback(
    (intent: WorkLinkIntent | null) => {
      const canonical = intent
        ? (linkChoices.choices.find((choice) => sameLinkIdentity(choice, intent)) ?? null)
        : null;
      setSearchParams(writeWorkLinkIntent(searchParams, canonical), { replace: true });
      if (canonical) {
        setGardenAddressStable(canonical.garden);
        useWorkFlowStore.getState().setActionUID(canonical.actionUID);
      }
    },
    [linkChoices.choices, searchParams, setGardenAddressStable, setSearchParams]
  );

  const audio = useWorkAudioRecording();
  const { audioNotes } = audio;
  const {
    showDraftDialog,
    setShowDraftDialog,
    handleContinueDraft,
    handleStartFresh,
    isResumingFromUrl,
    clearActiveDraft,
    legacyRecovery,
    retryHydration,
  } = useDraftResume({
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
    restoreForm: form.reset,
  });
  const [retirementAttempt, setRetirementAttempt] = useState(0);
  const { saveOnExit } = useDraftAutoSave(
    {
      gardenAddress,
      actionUID,
      feedback,
      timeSpentMinutes,
      details,
      audioNotes,
      tags,
      location: roundWorkLocation(formLocation),
      currentStep: activeTab.toLowerCase() as "intro" | "media" | "details" | "review",
    },
    images,
    { enabled: !legacyRecovery }
  );

  useShareTargetIntake({
    searchParams,
    setSearchParams,
    setValue,
    setImages,
    saveOnExit,
    gardenAddress,
    actionUID,
  });

  useEffect(() => {
    ensureWorkSubmissionJourneyId();
  }, [ensureWorkSubmissionJourneyId]);
  useEffect(() => {
    if (!linkIntent) return;
    setGardenAddressStable(linkIntent.garden);
    useWorkFlowStore.getState().setActionUID(linkIntent.actionUID);
  }, [linkIntent, setGardenAddressStable]);
  useEffect(() => {
    const state = location.state as { gardenId?: string } | null;
    if (state?.gardenId && gardens.length > 0) setGardenAddressStable(state.gardenId as Address);
  }, [gardens.length, location.state, setGardenAddressStable]);
  useWorkDraftRetirement({
    completed: submissionCompleted,
    paused: isSchedulingDependentLink || !!pendingLinkRecovery,
    attempt: retirementAttempt,
    clearActiveDraft,
    schedule: scheduleNavigation,
    navigate: () =>
      navigate(linkIntent?.returnTo ?? homeRoute, { replace: true, viewTransition: true }),
  });

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
      setGardenAddress(joinableCommunityGarden.id as Address);
      toastService.success({
        title:
          result === "already-member"
            ? intl.formatMessage({
                id: "app.garden.alreadyMember",
                defaultMessage: "You are already a member of this garden",
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

  const changeTab = async (tab: WorkTab) => {
    try {
      await saveOnExit();
    } catch {
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    setActiveTab(tab);
  };
  const submit = async () => {
    if (!gardenAddress || actionUID === null || !findActionByUID(actions, actionUID)) return false;
    if (hasLinkIntentParams && linkIntentStatus !== "valid") return false;
    setLinkSchedulingSucceeded(false);
    if (linkIntent) setIsSchedulingDependentLink(true);
    try {
      await saveOnExit();
      workMutation.clearLastSubmissionOutcome();
      await form.uploadWork();
      const outcome = workMutation.getLastSubmissionOutcome();
      if (!outcome) return false;
      if (linkIntent && outcome) {
        const payload: PendingLinkRecovery["payload"] = {
          clientOperationId: `work-link:${outcome.clientWorkId}:${linkIntent.commitmentId}:${linkIntent.requirementIndex}`,
          commitmentId: linkIntent.commitmentId,
          clientWorkId: outcome.clientWorkId,
          ...(outcome.kind === "direct" ? {} : { sourceWorkJobId: outcome.jobId }),
          requirementIndex: linkIntent.requirementIndex,
          gardenAddress: linkIntent.garden as `0x${string}`,
        };
        try {
          await commitmentJobs.enqueue({ act: "workLink", payload });
          setPendingLinkRecovery(null);
          setLinkSchedulingSucceeded(true);
        } catch (error) {
          setPendingLinkRecovery({ intent: linkIntent, payload, error });
          logger.error("Work submitted but dependent commitment link could not be queued", {
            error,
            source: "GardenFlow",
            clientWorkId: outcome.clientWorkId,
          });
        } finally {
          setIsSchedulingDependentLink(false);
        }
      }
      return true;
    } catch (error) {
      setIsSchedulingDependentLink(false);
      logger.error("Work submission failed", { error, source: "GardenFlow" });
      return false;
    }
  };
  const retryLinkOnly = useCallback(async () => {
    if (!pendingLinkRecovery) return false;
    setLinkSchedulingSucceeded(false);
    setIsSchedulingDependentLink(true);
    try {
      await commitmentJobs.enqueue({ act: "workLink", payload: pendingLinkRecovery.payload });
      setPendingLinkRecovery(null);
      setLinkSchedulingSucceeded(true);
      return true;
    } catch (error) {
      setPendingLinkRecovery((current) => (current ? { ...current, error } : current));
      return false;
    } finally {
      setIsSchedulingDependentLink(false);
    }
  }, [commitmentJobs, pendingLinkRecovery]);
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
        { id: "app.syncBar.syncing", defaultMessage: "Sending {count} items..." },
        { count: Math.max(pendingCount, 1) }
      );
    }
    return pendingCount > 0
      ? intl.formatMessage(
          { id: "app.syncBar.pendingOnline", defaultMessage: "{count} items waiting to send" },
          { count: pendingCount }
        )
      : null;
  }, [activeTab, intl, isOnline, pendingCount, syncStatus, workMutation.isPending]);
  const draftStatus = useDraftSaveStatus();
  const canProceed =
    !isResumingFromUrl &&
    !legacyRecovery &&
    (draftStatus.missingAttachments?.length ?? 0) === 0 &&
    canProceedWithWorkSubmission({
      tab: activeTab,
      gardenAddress,
      actionUID,
      imageCount: images.filter((file) => file.type.startsWith("image/")).length,
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
      ...draftStatus,
      legacyRecovery,
      retry: async () => {
        if (submissionCompleted) setRetirementAttempt((attempt) => attempt + 1);
        else if (!useWorkFlowStore.getState().draftHydrated) retryHydration();
        else await saveOnExit();
      },
      showDraftDialog,
      close: () => setShowDraftDialog(false),
      recover: () => setShowDraftDialog(true),
      manage: () => {
        useUIStore.getState().openWorkDashboard("drafts");
        navigate(homeRoute);
      },
      handleContinueDraft,
      startFresh: async () => {
        const scope = useWorkFlowStore.getState().draftScope;
        await handleStartFresh();
        if (scope === useWorkFlowStore.getState().draftScope) media.resetBrokenMedia();
      },
    },
    exit: async () => {
      try {
        await saveOnExit();
      } catch {
        return;
      }
      navigate(homeRoute, { viewTransition: true });
    },
    isJoiningCommunityGarden:
      join.isJoining &&
      (!join.joiningGardenId || join.joiningGardenId === joinableCommunityGarden?.id),
    isRecording: audio.isRecording,
    isWalletRequestExpired,
    joinCommunityGarden,
    linkIntent,
    linkGardenAddress: linkIntent?.garden ?? null,
    linkIntentStatus,
    commitmentLinkChoices: linkChoices.choices,
    commitmentLinkChoicesLoading: linkChoices.isLoading,
    commitmentLinkChoicesError: linkChoices.error,
    refetchCommitmentLinkChoices: linkChoices.refetch,
    clearLinkIntent,
    selectLinkIntent,
    isSchedulingDependentLink,
    linkSchedulingError: pendingLinkRecovery?.error ?? null,
    linkSchedulingSucceeded,
    hasPendingLinkRecovery: pendingLinkRecovery !== null,
    retryLinkOnly,
    submissionOutcome: workMutation.lastSubmissionOutcome,
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
    showSkeleton:
      isResumingFromUrl || (selection.isLoading && actions.length === 0 && gardens.length === 0),
    submissionCompleted,
    submit,
    toggleAudioRecording: audio.toggle,
    workSubmissionJourneyId,
    ensureWorkSubmissionJourneyId,
    authMode,
  };
}
