import { RiArrowRightSLine, RiImage2Fill } from "@remixicon/react";
import React, { Suspense, useState } from "react";
import { useIntl } from "react-intl";
import { Await, useLoaderData, useNavigate } from "react-router-dom";

import { Button } from "@/components/UI/Button";
import { DuplicateWorkWarning } from "@/components/UI/DuplicateWorkWarning/DuplicateWorkWarning";
import { FormProgress } from "@/components/UI/Form/Progress";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { DEFAULT_CHAIN_ID } from "@/config";
import { defaultDeduplicationManager, type DuplicateCheckResult } from "@/modules/deduplication";
// import { ActionCardSkeleton } from "@/components/UI/Card/ActionCardSkeleton";
// import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";

import { useWork, WorkTab } from "@/providers/work";

import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";

const Work: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const chainId = DEFAULT_CHAIN_ID;
  const { form, activeTab, setActiveTab, workMutation } = useWork();
  const loader = useLoaderData() as { actions: Promise<Action[]>; gardens: Promise<Garden[]> };

  // State for duplicate warning modal
  const [duplicateWarning, setDuplicateWarning] = useState<{
    workData: unknown;
    duplicateInfo: DuplicateCheckResult;
  } | null>(null);

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

  void workMutation; // Avoid unused warnings for status; mutation state handled via toasts

  // We'll resolve actions/gardens via Suspense when needed
  // Helper to render Review step with data (never block UI; use fallbacks)
  const renderReview = (actions: Action[], gardens: Garden[]) => {
    const garden = gardens.find((g) => g.id === gardenAddress);
    const action = actions.find((a) => {
      if (!actionUID) return false;
      const idPart = a.id?.split("-").pop();
      const numeric = Number(idPart);
      return Number.isFinite(numeric) && numeric === actionUID;
    });

    const fallbackGarden: Garden =
      garden ||
      ({
        id: gardenAddress || "",
        tokenAddress: "",
        tokenID: 0,
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

    const fallbackAction: Action =
      action ||
      ({
        id: `${chainId}-${actionUID ?? 0}`,
        startTime: Date.now(),
        endTime: Date.now(),
        title: intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected Action" }),
        instructions: "",
        capitals: [],
        media: ["/images/no-image-placeholder.png"],
        createdAt: Date.now(),
        description: "",
        inputs: [],
      } as unknown as Action);

    return (
      <WorkReview
        instruction={intl.formatMessage({
          id: "app.garden.submit.tab.review.instruction",
          defaultMessage: "Check if the information is correct",
        })}
        garden={fallbackGarden}
        action={fallbackAction}
        images={images}
        values={form.values}
        feedback={feedback}
        plantCount={plantCount}
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
    // Resolve action title for duplicate detection
    let computedTitle = `Work - ${new Date().toISOString()}`;
    try {
      const actions = await loader.actions;
      const found = actions.find((a) => {
        if (actionUID === undefined || actionUID === null) {
          return false;
        }
        const idPart = a.id?.split("-").pop();
        const numeric = Number(idPart);
        return Number.isFinite(numeric) && numeric === actionUID;
      });
      if (found?.title) computedTitle = found.title;
    } catch {
      return false;
    }

    const workData = {
      type: "work",
      chainId,
      data: {
        feedback,
        plantSelection,
        plantCount,
        title: computedTitle,
        actionUID,
        gardenAddress,
      },
      images,
    };

    try {
      const duplicateResult = await defaultDeduplicationManager.performComprehensiveCheck(workData);

      if (duplicateResult.isDuplicate) {
        setDuplicateWarning({
          workData,
          duplicateInfo: duplicateResult,
        });
        return false;
      }

      // No duplicates, proceed with normal submission
      uploadWork();
      return true;
    } catch {
      // Proceed with submission if duplicate check fails
      uploadWork();
      return true;
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
      primaryDisabled: images.length < 2,
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
          try {
            sessionStorage.setItem("openWorkDashboard", "1");
          } catch {}
          navigate("/home");
          form.reset();
          setImages([]);
        }
      },
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.review.label",
        defaultMessage: "Upload Work",
      }),
      primaryDisabled: !state.isValid || state.isSubmitting,
      secondary: null,
      backButton: () => changeTab(WorkTab.Details),
    },
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
        return (
          <Suspense fallback={<div className="p-4" />}>
            {" "}
            {/* TODO: Add skeleton for full view mimicking the intro view */}
            <Await resolve={Promise.all([loader.actions, loader.gardens])}>
              {([actions, gardens]: [Action[], Garden[]]) => (
                <WorkIntro
                  actions={actions}
                  gardens={gardens}
                  selectedActionUID={actionUID}
                  selectedGardenAddress={gardenAddress}
                  setActionUID={setActionUID}
                  setGardenAddress={setGardenAddress}
                />
              )}
            </Await>
          </Suspense>
        );
      case WorkTab.Media:
        return (
          <WorkMedia
            instruction={intl.formatMessage({
              id: "app.garden.submit.tab.media.instruction",
              defaultMessage: "Please take a clear photo of the plants in the garden",
            })}
            needed={["whole_plant"]}
            optional={["leaves", "flowers", "fruits", "bark"]}
            images={images}
            setImages={setImages}
          />
        );
      case WorkTab.Details:
        return (
          <Suspense
            fallback={
              <div className="padded flex flex-col gap-4">
                <div className="h-24 w-full bg-slate-100 rounded-lg animate-pulse" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`field-skel-${i}`}
                    className="h-12 w-full bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <Await resolve={loader.actions}>
              {(actions: Action[]) => {
                const found = actions.find((a) => {
                  if (!actionUID) return false;
                  const idPart = String(a.id).split("-").pop();
                  const num = Number(idPart);
                  return Number.isFinite(num) && num === actionUID; // TODO: Refator to use json schemas and create a function to get the actionUID from the action
                });
                return (
                  <WorkDetails
                    instruction={intl.formatMessage({
                      id: "app.garden.submit.tab.details.instruction",
                      defaultMessage: "Provide detailed information and feedback",
                    })}
                    feedbackPlaceholder=""
                    inputs={found?.inputs ?? []}
                    register={register}
                    control={control}
                  />
                );
              }}
            </Await>
          </Suspense>
        );
      case WorkTab.Review:
        return (
          <Suspense
            fallback={
              <div className="padded">
                <WorkViewSkeleton showMedia={true} showActions={false} numDetails={4} />
              </div>
            }
          >
            <Await resolve={Promise.all([loader.actions, loader.gardens])}>
              {([actions, gardens]: [Action[], Garden[]]) => renderReview(actions, gardens)}
            </Await>
          </Suspense>
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

      {/* Duplicate Work Warning Modal */}
      {duplicateWarning && (
        <DuplicateWorkWarning
          workData={duplicateWarning.workData}
          duplicateInfo={duplicateWarning.duplicateInfo}
          onProceed={() => {
            setDuplicateWarning(null);
            uploadWork();
            changeTab(WorkTab.Review);
            form.reset();
          }}
          onCancel={() => {
            setDuplicateWarning(null);
          }}
          onViewDuplicate={(workId: string) => {
            // Navigate to view the existing work
            setDuplicateWarning(null);
            navigate(`/home/${gardenAddress}/work/${workId}`, { state: { from: "garden" } });
          }}
        />
      )}
    </>
  );
};

export default Work;
