import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import {
  useActionTranslation,
  useDraftAutoSave,
  useDraftResume,
  useGardenTranslation,
} from "@green-goods/shared/hooks";
import { useWork, WorkTab } from "@green-goods/shared/providers";
import { useWorkFlowStore } from "@green-goods/shared/stores/useWorkFlowStore";
import { findActionByUID } from "@green-goods/shared/utils";
import {
  RiArrowRightSLine,
  RiCameraFill,
  RiHammerFill,
  RiImageFill,
  RiPlantFill,
} from "@remixicon/react";
import React, { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/Actions";
import { ActionCardSkeleton, FormInfo, GardenCardSkeleton } from "@/components/Cards";
import { FormProgress } from "@/components/Communication";
import { DraftDialog } from "@/components/Dialogs";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";

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
            <GardenCardSkeleton media="small" height="selection" />
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
  const { form, activeTab, setActiveTab, actions, gardens, isLoading, workMutation } = useWork();

  const canBypassMediaRequirement = import.meta.env.VITE_DEBUG_MODE === "true";
  const submissionCompleted = useWorkFlowStore((s) => s.submissionCompleted);

  // Media upload click handlers (exposed by WorkMedia for PostHog tracking)
  const galleryClickRef = useRef<(() => void) | null>(null);
  const cameraClickRef = useRef<(() => void) | null>(null);

  if (!form) {
    return null;
  }

  const {
    state,
    images,
    setImages,
    actionUID,
    setActionUID,
    gardenAddress,
    setGardenAddress,
    register,
    control,
    uploadWork,
    feedback,
    plantSelection,
    plantCount,
    timeSpentMinutes,
  } = form;

  // Draft save on exit (only saves when user navigates away, not automatically)
  const { saveOnExit } = useDraftAutoSave(
    { gardenAddress, actionUID, feedback, plantSelection, plantCount, timeSpentMinutes },
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
      plantSelection,
      plantCount,
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
      setGardenAddress(navigationState.gardenId);
    }
  }, [location.state, gardens.length, setGardenAddress]);

  const handleStartFresh = async () => {
    await clearDraft();
    useWorkFlowStore.getState().reset();
    form.reset();
  };

  // Navigate when submission completes
  useEffect(() => {
    if (!submissionCompleted) return;

    // Clear the draft on successful submission
    clearActiveDraft().catch((error) => {
      console.error("[Garden] Failed to clear draft after submission:", error);
    });

    const timer = setTimeout(() => {
      navigate("/home", { replace: true, viewTransition: true });
      requestAnimationFrame(() => {
        useWorkFlowStore.getState().reset();
        form.reset();
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [submissionCompleted, navigate, form, clearActiveDraft]);

  // Selected action and garden with translations
  const selectedAction = useMemo(() => {
    if (!actions.length || typeof actionUID !== "number") return null;
    return findActionByUID(actions, actionUID);
  }, [actions, actionUID]);

  const { translatedAction } = useActionTranslation(selectedAction);

  const selectedGarden = useMemo(() => {
    if (!gardens.length || !gardenAddress) return null;
    return gardens.find((g) => g.id === gardenAddress) ?? null;
  }, [gardens, gardenAddress]);

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

  // Create fallback objects for review step
  const getReviewData = () => {
    const garden: Garden = translatedGarden || {
      id: gardenAddress || "",
      chainId: 84532,
      tokenAddress: "",
      tokenID: BigInt(0),
      name: intl.formatMessage({ id: "app.garden.unknown", defaultMessage: "Unknown Garden" }),
      description: "",
      location: "",
      bannerImage: "/images/no-image-placeholder.png",
      gardeners: [],
      operators: [],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    };

    const action: Action = translatedAction || {
      id: `${chainId}-${actionUID ?? 0}`,
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
      console.error("[GardenFlow] Work submission failed:", error);
      return false;
    }
  };

  const changeTab = (tab: WorkTab) => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    setActiveTab(tab);
  };

  // Handle exit from garden flow - save draft if there's meaningful progress
  const handleExitFlow = async () => {
    await saveOnExit();
    navigate("/home", { viewTransition: true });
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
              if (galleryClickRef.current) {
                galleryClickRef.current();
              } else {
                document.getElementById("work-media-upload")?.click();
              }
            }}
            label=""
            className="w-12 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="pilled"
            mode="stroke"
            leadingIcon={<RiImageFill className="text-primary w-5 h-5" />}
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
            className="w-12 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="pilled"
            mode="stroke"
            leadingIcon={<RiCameraFill className="text-primary w-5 h-5" />}
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
      primaryLabel: intl.formatMessage({
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
            selectedActionUID={actionUID}
            selectedGardenAddress={gardenAddress}
            setActionUID={setActionUID}
            setGardenAddress={setGardenAddress}
          />
        );
      case WorkTab.Media:
        return (
          <WorkMedia
            config={mediaConfig}
            images={images}
            setImages={setImages}
            minRequired={minRequired}
            onGalleryClickRef={galleryClickRef}
            onCameraClickRef={cameraClickRef}
          />
        );
      case WorkTab.Details:
        return (
          <WorkDetails
            config={detailsConfig}
            inputs={detailInputs}
            register={register}
            control={control}
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
            values={form.values}
            feedback={feedback}
            plantCount={plantCount ?? 0}
            plantSelection={plantSelection}
            timeSpentMinutes={timeSpentMinutes}
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
        <div className="padded relative flex flex-col gap-4 flex-1">{renderTabContent()}</div>
        <div className="flex fixed left-0 bottom-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] w-full z-[10000] bg-bg-white-0 border-t border-stroke-soft-200">
          <div className="flex flex-row gap-4 w-full padded">
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
              shape="pilled"
              trailingIcon={<RiArrowRightSLine className="w-5 h-5" />}
            />
          </div>
        </div>
      </form>
    </>
  );
};

export default Work;
