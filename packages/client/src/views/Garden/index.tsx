import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import { RiArrowRightSLine, RiHammerFill, RiImage2Fill, RiPlantFill } from "@remixicon/react";
import React, { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/UI/Button";
import { ActionCardSkeleton } from "@/components/UI/Card/ActionCardSkeleton";
import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";
import { FormInfo } from "@/components/UI/Form/Info";
import { FormProgress } from "@/components/UI/Form/Progress";
import { TopNav } from "@/components/UI/TopNav/TopNav";

// import { ActionCardSkeleton } from "@/components/UI/Card/ActionCardSkeleton";
// import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";

import { useWork, WorkTab } from "@green-goods/shared/providers/work";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";

const Work: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const chainId = DEFAULT_CHAIN_ID;
  const { form, activeTab, setActiveTab, actions, gardens, isLoading, workMutation } = useWork();
  const canBypassMediaRequirement = import.meta.env.VITE_DEBUG_MODE === "true";

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
  } = form;

  // mutation state handled via toasts inside uploadWork()

  // Prefer resolved data from React Query
  // Helper to render Review step with data (never block UI; use fallbacks)
  const getActionUIDFromId = (id?: string): number | null => {
    if (!id) return null;
    const last = String(id).split("-").pop();
    const num = Number(last);
    return Number.isFinite(num) ? num : null;
  };

  const selectedAction = useMemo(() => {
    if (!actions.length || typeof actionUID !== "number") return null;
    return (
      actions.find((a: Action) => {
        const uid = getActionUIDFromId(a.id);
        return uid !== null && uid === actionUID;
      }) || null
    );
  }, [actions, actionUID]);

  const selectedGarden = useMemo(() => {
    if (!gardens.length || !gardenAddress) return null;
    return gardens.find((g) => g.id === gardenAddress) || null;
  }, [gardens, gardenAddress]);

  const defaultMediaConfig = useMemo(
    () => ({
      title: intl.formatMessage({
        id: "app.garden.upload.title",
        description: "Upload Media",
      }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.media.instruction",
        defaultMessage: "Please take a clear photo of the plants in the garden",
      }),
      required: false,
      needed: [] as string[],
      optional: [] as string[],
      maxImageCount: 0,
    }),
    [intl]
  );

  const mediaConfig = useMemo(() => {
    if (!selectedAction?.mediaInfo) {
      return defaultMediaConfig;
    }

    const {
      needed = [],
      optional = [],
      maxImageCount = defaultMediaConfig.maxImageCount,
      ...rest
    } = selectedAction.mediaInfo;

    return {
      ...defaultMediaConfig,
      ...rest,
      needed: Array.isArray(needed) ? needed : [],
      optional: Array.isArray(optional) ? optional : [],
      maxImageCount,
    };
  }, [selectedAction, defaultMediaConfig]);

  const defaultDetailsConfig = useMemo(
    () => ({
      title: intl.formatMessage({
        id: "app.garden.details.title",
        description: "Enter Details",
      }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.details.instruction",
        defaultMessage: "Provide detailed information and feedback",
      }),
      feedbackPlaceholder: intl.formatMessage({
        id: "app.garden.details.feedbackPlaceholder",
        defaultMessage: "Provide feedback or any observations",
      }),
    }),
    [intl]
  );

  const detailsConfig = useMemo(() => {
    if (!selectedAction?.details) {
      return defaultDetailsConfig;
    }
    return {
      ...defaultDetailsConfig,
      ...selectedAction.details,
    };
  }, [selectedAction, defaultDetailsConfig]);

  const defaultReviewConfig = useMemo(
    () => ({
      title: intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.review.instruction",
        defaultMessage: "Check if the information is correct",
      }),
    }),
    [intl]
  );

  const reviewConfig = useMemo(() => {
    if (!selectedAction?.review) {
      return defaultReviewConfig;
    }
    return {
      ...defaultReviewConfig,
      ...selectedAction.review,
    };
  }, [selectedAction, defaultReviewConfig]);

  const detailInputs = useMemo(() => selectedAction?.inputs ?? [], [selectedAction]);

  useEffect(() => {
    if (actions.length) {
      console.log(
        "[GardenFlow] Actions resolved from indexer",
        actions.map((action) => ({
          id: action.id,
          title: action.title,
          hasMediaInfo: Boolean(action.mediaInfo),
          detailInputKeys: action.inputs?.map((input) => input.key) ?? [],
          reviewHasCopy: Boolean(action.review),
        }))
      );
    }
  }, [actions]);

  useEffect(() => {
    if (selectedAction) {
      console.log("[GardenFlow] Selected action state", {
        id: selectedAction.id,
        title: selectedAction.title,
        mediaInfo: selectedAction.mediaInfo,
        details: selectedAction.details,
        review: selectedAction.review,
      });
    } else if (typeof actionUID === "number") {
      console.log("[GardenFlow] No action matched for selected UID", {
        actionUID,
        availableIds: actions.map((action) => action.id),
      });
    }
  }, [selectedAction, actionUID, actions]);

  useEffect(() => {
    if (selectedGarden) {
      console.log("[GardenFlow] Selected garden state", {
        id: selectedGarden.id,
        name: selectedGarden.name,
      });
    } else if (gardenAddress) {
      console.log("[GardenFlow] No garden matched for address", {
        gardenAddress,
        availableIds: gardens.map((garden) => garden.id),
      });
    }
  }, [selectedGarden, gardenAddress, gardens]);
  const renderReview = () => {
    const garden: Garden =
      selectedGarden ||
      ({
        id: gardenAddress || "",
        chainId: 84532, // Default to Base Sepolia
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
      } as Garden);

    const fallbackAction: Action = {
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

    const action = selectedAction ?? (fallbackAction as Action);

    console.log("[GardenFlow] Rendering review", {
      actionId: action?.id,
      usingActionFallback: !selectedAction,
      gardenId: garden?.id,
      usingGardenFallback: !selectedGarden,
    });

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
      />
    );
  };

  // Enhanced upload function with duplicate detection
  const handleWorkSubmission = async (): Promise<boolean> => {
    if (!gardenAddress || actionUID === null) {
      return false;
    }

    // Check for duplicates first
    // Note: computedTitle could be used for duplicate detection if needed in future
    try {
      const found = actions.find((a: Action) => {
        if (actionUID === undefined || actionUID === null) {
          return false;
        }
        const idPart = a.id?.split("-").pop();
        const numeric = Number(idPart);
        return Number.isFinite(numeric) && numeric === actionUID;
      });
      // Action found validation (title could be used for deduplication)
      if (!found) {
        return false;
      }
    } catch {
      return false;
    }

    // Deduplication removed - was always a no-op since remote API doesn't exist
    try {
      const result = await uploadWork();
      return Boolean(result);
    } catch (error) {
      console.error("[GardenFlow] Work submission threw", error);
      return false;
    }
  };

  const changeTab = (tab: WorkTab) => {
    document.getElementById("root")?.scrollIntoView({ behavior: "instant" });
    setActiveTab(tab);
  };

  const tabActions = {
    [WorkTab.Intro]: {
      primary: () => changeTab(WorkTab.Media),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.intro.label",
        defaultMessage: "Start Gardening",
      }),
      primaryDisabled: !gardenAddress || typeof actionUID !== "number",
      secondary: null,
      backButton: () => navigate("/home"),
    },
    [WorkTab.Media]: {
      primary: () => changeTab(WorkTab.Details),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.media.label",
        defaultMessage: "Add Details",
      }),
      primaryDisabled: !canBypassMediaRequirement && images.length < 2,
      secondary: () => document.getElementById("work-media-upload")?.click(),
      secondaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.media.secondaryLabel",
        defaultMessage: "Upload Media",
      }),
      backButton: () => changeTab(WorkTab.Intro),
    },
    [WorkTab.Details]: {
      primary: () => changeTab(WorkTab.Review),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.details.label",
        defaultMessage: "Review Work",
      }),
      primaryDisabled: !state.isValid,
      secondary: null,
      backButton: () => changeTab(WorkTab.Media),
    },
    [WorkTab.Review]: {
      primary: async () => {
        // Check for duplicates before submission and proceed based on result
        const proceeded = await handleWorkSubmission();
        if (proceeded) {
          navigate("/home");
          form.reset();
          setImages([]);
          setActiveTab(WorkTab.Intro);
        }
      },
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.review.label",
        defaultMessage: "Upload Work",
      }),
      primaryDisabled: !state.isValid || state.isSubmitting || workMutation.isPending,
      secondary: null,
      backButton: () => changeTab(WorkTab.Details),
    },
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
        return isLoading && actions.length === 0 && gardens.length === 0 ? (
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
              {Array.from({ length: 4 }).map((_, idx) => (
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
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`garden-skel-${idx}`} className="min-w-[16rem]">
                  <GardenCardSkeleton media="small" height="selection" />
                </div>
              ))}
            </div>
          </div>
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
        return <WorkMedia config={mediaConfig} images={images} setImages={setImages} />;
      case WorkTab.Details:
        return (
          <WorkDetails
            config={detailsConfig}
            inputs={detailInputs}
            register={register}
            control={control}
          />
        );
      case WorkTab.Review:
        return isLoading && actions.length === 0 && gardens.length === 0 ? (
          <div className="padded">
            <WorkViewSkeleton showMedia={true} showActions={false} numDetails={4} />
          </div>
        ) : (
          renderReview()
        );
    }
  };

  return (
    <>
      <TopNav onBackClick={tabActions[activeTab].backButton} overlay>
        <FormProgress
          currentStep={Object.values(WorkTab).indexOf(activeTab) + 1}
          steps={Object.values(WorkTab).slice(0, 4)}
        />
      </TopNav>

      <form
        id="work-form"
        className="relative py-6 pt-16 flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
      >
        <div className="padded relative flex flex-col gap-4 flex-1">{renderTabContent()}</div>
        <div className="flex fixed left-0 bottom-0 py-3 w-full z-[10000] bg-white border-t border-stroke-soft-200">
          <div className="flex flex-row gap-4 w-full padded">
            {tabActions[activeTab].secondary && (
              <Button
                onClick={tabActions[activeTab].secondary}
                label={tabActions[activeTab].secondaryLabel}
                className="w-full"
                variant="neutral"
                type="button"
                shape="pilled"
                mode="stroke"
                leadingIcon={<RiImage2Fill className="text-primary w-5 h-5" />}
              />
            )}
            <Button
              onClick={tabActions[activeTab].primary}
              label={tabActions[activeTab].primaryLabel}
              disabled={tabActions[activeTab].primaryDisabled}
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
