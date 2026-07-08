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
  useOffline,
  useTimeout,
  useJoinGarden,
  useUser,
  useWorkFormContext,
  useWorkFlowStore,
  useWorkSelection,
  WorkTab,
} from "@green-goods/shared";
import {
  RiArrowRightSLine,
  RiCameraFill,
  RiHammerFill,
  RiImageFill,
  RiMicLine,
  RiPlantFill,
  RiStopFill,
} from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/Actions";
import { ActionCardSkeleton, FormInfo, GardenCardSkeleton } from "@/components/Cards";
import { FormProgress } from "@/components/Communication";
import { DraftDialog } from "@/components/Dialogs";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { APP_ROUTES } from "@/config/pwa-routing";
import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { trackWorkMediaJourneyEvent } from "./mediaAnalytics";

// Loading skeleton for intro tab
const IntroSkeleton: React.FC = () => {
  const intl = useIntl();
  return (
    <div className="flex flex-col gap-6">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select your action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <div className="flex gap-4 overflow-x-auto">
        {[0, 1, 2, 3].map((idx) => (
          <div key={`action-skel-${idx}`} className="min-w-[16rem]">
            <ActionCardSkeleton media="small" height="selection" />
          </div>
        ))}
      </div>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourGarden",
          defaultMessage: "Select your garden",
        })}
        info={intl.formatMessage({
          id: "app.garden.whichGarden",
          defaultMessage: "Which garden are you submitting for?",
        })}
        Icon={RiPlantFill}
      />
      <div className="flex gap-4 overflow-x-auto">
        {[0, 1, 2, 3].map((idx) => (
          <div key={`garden-skel-${idx}`} className="min-w-[16rem]">
            <GardenCardSkeleton media="small" height="selection" showStats={false} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Work: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = DEFAULT_CHAIN_ID;
  const {
    actions,
    gardens,
    hasJoinedGardens,
    isLoading,
    joinableCommunityGarden,
    activeTab,
    setActiveTab,
    selectedDomain,
    setSelectedDomain,
    actionUID,
    setActionUID,
    gardenAddress,
    setGardenAddress,
  } = useWorkSelection();
  const form = useWorkFormContext();
  const { workMutation } = form;
  const { authMode } = useUser();
  const {
    joinGarden,
    isJoining: isJoiningCommunityGarden,
    joiningGardenId: joiningCommunityGardenId,
  } = useJoinGarden();

  const canBypassMediaRequirement = import.meta.env.VITE_DEBUG_MODE === "true";
  const submissionCompleted = useWorkFlowStore((s) => s.submissionCompleted);
  const workSubmissionJourneyId = useWorkFlowStore((s) => s.workSubmissionJourneyId);
  const ensureWorkSubmissionJourneyId = useWorkFlowStore((s) => s.ensureWorkSubmissionJourneyId);
  const setGardenAddressStable = useWorkFlowStore((s) => s.setGardenAddress);
  const audioNotes = useWorkFlowStore((s) => s.audioNotes);
  const setAudioNotes = useWorkFlowStore((s) => s.setAudioNotes);
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const { set: scheduleNavigation } = useTimeout();
  const [brokenMediaIds, setBrokenMediaIds] = useState<Set<string>>(() => new Set());
  const brokenMediaIdsRef = useRef(brokenMediaIds);

  // Media upload click handlers (exposed by WorkMedia for PostHog tracking)
  const mediaClickRef = useRef<(() => void) | null>(null);
  const cameraClickRef = useRef<(() => void) | null>(null);

  // Audio recording from action bar (toggle button — no in-page recorder UI)
  const {
    isRecording,
    elapsed: recordingElapsed,
    toggle: toggleAudioRecording,
  } = useAudioRecording({
    onRecordingComplete: (file) => {
      // Read current state directly — Zustand setters don't accept updater functions
      const current = useWorkFlowStore.getState().audioNotes;
      setAudioNotes([...current, file]);
      track(
        "audio_note_recorded",
        { duration: "unknown", noteIndex: current.length },
        { includeSessionId: false }
      );
    },
  });

  const {
    state,
    images,
    setImages,
    register,
    control,
    setValue,
    uploadWork,
    feedback,
    timeSpentMinutes,
    values,
  } = form;

  useEffect(() => {
    brokenMediaIdsRef.current = brokenMediaIds;
  }, [brokenMediaIds]);

  useEffect(() => {
    ensureWorkSubmissionJourneyId();
  }, [ensureWorkSubmissionJourneyId]);

  // Draft save on exit (only saves when user navigates away, not automatically)
  const { saveOnExit } = useDraftAutoSave(
    { gardenAddress, actionUID, feedback, timeSpentMinutes },
    images
  );

  // Draft resume (handles URL params and meaningful draft detection)
  const {
    showDraftDialog,
    handleContinueDraft,
    handleStartFresh: clearDraft,
    clearActiveDraft,
  } = useDraftResume({
    formState: {
      images,
      gardenAddress,
      actionUID,
      feedback,
      timeSpentMinutes,
    },
    isOnIntroTab: activeTab === WorkTab.Intro,
    searchParams,
    setSearchParams,
  });

  // Pre-select garden from navigation state (e.g., from notifications)
  useEffect(() => {
    const navigationState = location.state as { gardenId?: string } | null;
    if (navigationState?.gardenId && gardens.length > 0) {
      setGardenAddressStable(navigationState.gardenId);
    }
  }, [location.state, gardens.length, setGardenAddressStable]);

  // Blob-URL cleanup for the entire Work flow.
  //
  // Cleanup MUST live at this level, not inside WorkMedia. When the user
  // navigates Media → Review, Media unmounts in the same commit that mounts
  // Review. Review's useMemo runs during render and hands back the cached
  // blob URL; React then mutates the DOM (Review's <img src=cachedUrl>);
  // then passive effects fire and Media's old cleanup would revoke that
  // same URL, breaking the in-flight blob fetch and producing the
  // "image disappears on Review" regression — most visibly on gallery
  // uploads, where the larger payload loses the race that camera captures
  // sometimes win. Letting cleanup follow the parent Work component means
  // blob URLs stay valid for the lifetime of the submission flow and are
  // only revoked when the user truly exits.
  useEffect(() => {
    return () => {
      mediaResourceManager.cleanupUrls("work-draft");
      mediaResourceManager.cleanupUrls("work-draft-video");
    };
  }, []);

  const handleStartFresh = async () => {
    await clearDraft();
    setBrokenMediaIds(new Set());
    useWorkFlowStore.getState().reset();
    form.reset();
  };

  // Navigate when submission completes
  useEffect(() => {
    if (!submissionCompleted) return;

    // Clear the draft on successful submission
    clearActiveDraft().catch((error) => {
      logger.error("Failed to clear draft after submission", { error, source: "Garden" });
    });

    const cancelNavigation = scheduleNavigation(() => {
      navigate(APP_ROUTES.home, { replace: true, viewTransition: true });
      requestAnimationFrame(() => {
        useWorkFlowStore.getState().reset();
        form.reset();
      });
    }, 800);

    return cancelNavigation;
  }, [submissionCompleted, navigate, form, clearActiveDraft, scheduleNavigation]);

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
        {
          id: "app.syncBar.syncing",
          defaultMessage: "Syncing {count} items...",
        },
        { count: Math.max(pendingCount, 1) }
      );
    }

    if (pendingCount > 0) {
      return intl.formatMessage(
        {
          id: "app.syncBar.pendingOnline",
          defaultMessage: "{count} items waiting to sync",
        },
        { count: pendingCount }
      );
    }

    return null;
  }, [activeTab, isOnline, intl, pendingCount, syncStatus, workMutation.isPending]);

  // Selected action and garden with translations
  const selectedAction = useMemo(() => {
    if (!actions.length || typeof actionUID !== "number") return null;
    return findActionByUID(actions, actionUID);
  }, [actions, actionUID]);

  const { translatedAction } = useActionTranslation(selectedAction);

  const selectedGarden = useMemo(() => {
    if (!gardenAddress) return null;
    return (
      gardens.find((g) => g.id === gardenAddress) ??
      (joinableCommunityGarden?.id === gardenAddress ? joinableCommunityGarden : null)
    );
  }, [gardens, gardenAddress, joinableCommunityGarden]);

  const { translatedGarden } = useGardenTranslation(selectedGarden);

  // Configurations with action-specific overrides
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
  }, [translatedAction, intl]);

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
  }, [translatedAction, intl]);

  const reviewConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.review.instruction",
        defaultMessage: "Check if the information is correct",
      }),
    };
    return translatedAction?.review ? { ...defaults, ...translatedAction.review } : defaults;
  }, [translatedAction, intl]);

  const detailInputs = useMemo(() => translatedAction?.inputs ?? [], [translatedAction]);

  const getReviewData = () => {
    const garden: Garden = translatedGarden || {
      id: gardenAddress || "",
      chainId,
      tokenAddress: "",
      tokenID: BigInt(0),
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
      id: `${chainId}-${actionUID ?? 0}`,
      slug: "",
      domain: selectedDomain ?? 0,
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

    return { garden, action };
  };

  const handleWorkSubmission = async (): Promise<boolean> => {
    if (!gardenAddress || actionUID === null || !findActionByUID(actions, actionUID)) {
      return false;
    }
    try {
      return Boolean(await uploadWork());
    } catch (error) {
      logger.error("Work submission failed", { error, source: "GardenFlow" });
      return false;
    }
  };

  const markMediaPreviewFailed = useCallback(
    (file: File, surface: "media" | "review") => {
      const mediaId = getWorkMediaId(file);
      if (brokenMediaIdsRef.current.has(mediaId)) return;

      const journeyId = ensureWorkSubmissionJourneyId();
      setBrokenMediaIds((prev) => {
        const next = new Set(prev);
        next.add(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });

      trackWorkMediaJourneyEvent("work_media_preview_failed", {
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
    [actionUID, authMode, ensureWorkSubmissionJourneyId]
  );

  const handleRemoveMedia = useCallback(
    (file: File, surface: "media" | "review") => {
      const mediaId = getWorkMediaId(file);
      const journeyId = ensureWorkSubmissionJourneyId();

      setImages((prev) => prev.filter((item) => getWorkMediaId(item) !== mediaId));
      setBrokenMediaIds((prev) => {
        if (!prev.has(mediaId)) return prev;
        const next = new Set(prev);
        next.delete(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });

      trackWorkMediaJourneyEvent("work_media_removed", {
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
    [actionUID, authMode, ensureWorkSubmissionJourneyId, setImages]
  );

  const handleRemoveBrokenMedia = useCallback(
    (surface: "media" | "review") => {
      const idsToRemove = new Set(brokenMediaIdsRef.current);
      if (idsToRemove.size === 0) return;

      const journeyId = ensureWorkSubmissionJourneyId();
      setImages((prev) => prev.filter((file) => !idsToRemove.has(getWorkMediaId(file))));
      setBrokenMediaIds(new Set());
      brokenMediaIdsRef.current = new Set();

      trackWorkMediaJourneyEvent("work_broken_media_removed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        file_count: idsToRemove.size,
        broken_count: idsToRemove.size,
      });
    },
    [actionUID, authMode, ensureWorkSubmissionJourneyId, setImages]
  );

  const handleJoinCommunityGarden = useCallback(async () => {
    if (!joinableCommunityGarden?.id) return;

    try {
      const result = await joinGarden(joinableCommunityGarden.id);
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
          label: intl.formatMessage({
            id: "app.profile",
            defaultMessage: "Profile",
          }),
          onClick: () => navigate(APP_ROUTES.profile),
          dismissOnClick: true,
        },
      });
    }
  }, [intl, joinableCommunityGarden, joinGarden, navigate, setGardenAddress]);

  const changeTab = (tab: WorkTab) => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    setActiveTab(tab);
  };

  const isWalletRequestExpired = useMemo(() => {
    if (activeTab !== WorkTab.Review || !workMutation.error) return false;
    const originalError =
      workMutation.error instanceof Error && workMutation.error.cause instanceof Error
        ? workMutation.error.cause
        : workMutation.error;
    return parseContractError(originalError).name === "WalletRequestExpired";
  }, [activeTab, workMutation.error]);

  // Handle exit from garden flow - save draft if there's meaningful progress
  const handleExitFlow = async () => {
    await saveOnExit();
    navigate(APP_ROUTES.home, { viewTransition: true });
  };

  // Tab configuration
  const currentTab = {
    [WorkTab.Intro]: {
      primary: () => changeTab(WorkTab.Media),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.intro.label",
        defaultMessage: "Start Gardening",
      }),
      primaryDisabled: !gardenAddress || typeof actionUID !== "number",
      customSecondary: null,
      backButton: handleExitFlow,
    },
    [WorkTab.Media]: {
      primary: () => changeTab(WorkTab.Details),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.media.label",
        defaultMessage: "Add Details",
      }),
      primaryDisabled: !canBypassMediaRequirement && images.length < minRequired,
      customSecondary: (
        <>
          <Button
            onClick={() => {
              if (mediaClickRef.current) {
                mediaClickRef.current();
              } else {
                document.getElementById("work-media-upload")?.click();
              }
            }}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="regular"
            mode="stroke"
            leadingIcon={<RiImageFill className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />}
          />
          <Button
            onClick={() => {
              if (cameraClickRef.current) {
                cameraClickRef.current();
              } else {
                document.getElementById("work-media-camera")?.click();
              }
            }}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="regular"
            mode="stroke"
            leadingIcon={<RiCameraFill className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />}
          />
          <Button
            onClick={toggleAudioRecording}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant={isRecording ? "error" : "neutral"}
            type="button"
            shape="regular"
            mode={isRecording ? "filled" : "stroke"}
            leadingIcon={
              isRecording ? (
                <RiStopFill className={`w-5 h-5 ${pwaStatusStyles.error.foreground}`} />
              ) : (
                <RiMicLine className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />
              )
            }
          />
        </>
      ),
      backButton: () => changeTab(WorkTab.Intro),
    },
    [WorkTab.Details]: {
      primary: () => changeTab(WorkTab.Review),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.details.label",
        defaultMessage: "Review Work",
      }),
      primaryDisabled: !state.isValid,
      customSecondary: null,
      backButton: () => changeTab(WorkTab.Media),
    },
    [WorkTab.Review]: {
      primary: handleWorkSubmission,
      primaryLabel: isWalletRequestExpired
        ? intl.formatMessage({
            id: "app.garden.submit.tab.review.retryLabel",
            defaultMessage: "Submit again",
          })
        : intl.formatMessage({
            id: "app.garden.submit.tab.review.label",
            defaultMessage: "Upload Work",
          }),
      primaryDisabled: !state.isValid || state.isSubmitting || workMutation.isPending,
      customSecondary: null,
      backButton: () => changeTab(WorkTab.Details),
    },
  }[activeTab];

  const showSkeleton = isLoading && actions.length === 0 && gardens.length === 0;

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
        return showSkeleton ? (
          <IntroSkeleton />
        ) : (
          <WorkIntro
            actions={actions}
            gardens={gardens}
            hasJoinedGardens={hasJoinedGardens}
            isLoading={isLoading}
            joinableCommunityGarden={joinableCommunityGarden}
            isJoiningCommunityGarden={
              isJoiningCommunityGarden &&
              (!joiningCommunityGardenId ||
                joiningCommunityGardenId === joinableCommunityGarden?.id)
            }
            onJoinCommunityGarden={handleJoinCommunityGarden}
            selectedActionUID={actionUID}
            selectedGardenAddress={gardenAddress}
            selectedDomain={selectedDomain}
            setActionUID={setActionUID}
            setGardenAddress={setGardenAddress}
            setSelectedDomain={setSelectedDomain}
          />
        );
      case WorkTab.Media:
        return (
          <WorkMedia
            config={mediaConfig}
            images={images}
            setImages={setImages}
            audioNotes={audioNotes}
            setAudioNotes={setAudioNotes}
            minRequired={minRequired}
            onMediaClickRef={mediaClickRef}
            onCameraClickRef={cameraClickRef}
            isRecording={isRecording}
            recordingElapsed={recordingElapsed}
            brokenMediaIds={brokenMediaIds}
            onPreviewFailed={markMediaPreviewFailed}
            onRemoveMedia={handleRemoveMedia}
            onRemoveBrokenMedia={handleRemoveBrokenMedia}
            workSubmissionJourneyId={workSubmissionJourneyId}
            ensureWorkSubmissionJourneyId={ensureWorkSubmissionJourneyId}
            authMode={authMode}
            actionUID={actionUID}
          />
        );
      case WorkTab.Details:
        return (
          <WorkDetails
            config={detailsConfig}
            inputs={detailInputs}
            register={register}
            control={control}
            setValue={setValue}
          />
        );
      case WorkTab.Review: {
        if (showSkeleton) {
          return (
            <div className="padded">
              <WorkViewSkeleton showMedia showActions={false} numDetails={4} />
            </div>
          );
        }
        const { garden, action } = getReviewData();
        return (
          <WorkReview
            reviewConfig={reviewConfig}
            garden={garden}
            action={action}
            images={images}
            audioNotes={audioNotes}
            values={values}
            feedback={feedback}
            timeSpentMinutes={timeSpentMinutes}
            brokenMediaIds={brokenMediaIds}
            onPreviewFailed={markMediaPreviewFailed}
            onRemoveBrokenMedia={handleRemoveBrokenMedia}
          />
        );
      }
    }
  };

  return (
    <>
      <DraftDialog
        isOpen={showDraftDialog}
        onContinue={handleContinueDraft}
        onStartFresh={handleStartFresh}
        imageCount={images.length}
      />

      <TopNav onBackClick={currentTab.backButton} overlay>
        <FormProgress
          currentStep={submissionCompleted ? 5 : Object.values(WorkTab).indexOf(activeTab) + 1}
          steps={Object.values(WorkTab).slice(0, 4)}
        />
      </TopNav>

      <form
        id="work-form"
        className="relative py-6 pt-20 flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
      >
        <div className="padded relative flex flex-col gap-4 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {renderTabContent()}
        </div>
        <div className="flex fixed left-0 bottom-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] w-full z-modal bg-bg-white-0 border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden">
          <div className="flex flex-col gap-2 w-full padded">
            {queueStatusMessage && (
              <p className="text-xs text-text-sub-600 px-1" role="status" aria-live="polite">
                {queueStatusMessage}
              </p>
            )}
            <div className="flex flex-row gap-4 w-full">
              {currentTab.customSecondary}
              <Button
                onClick={currentTab.primary}
                label={currentTab.primaryLabel}
                disabled={currentTab.primaryDisabled}
                className="w-full"
                variant="primary"
                mode="filled"
                size="medium"
                type="button"
                shape="regular"
                trailingIcon={<RiArrowRightSLine className="w-5 h-5" />}
              />
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default Work;
