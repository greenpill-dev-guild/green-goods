import { RiArrowRightSLine, RiImage2Fill } from "@remixicon/react";
import { useState } from "react";
import { Form } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/UI/Button";
import { DuplicateWorkWarning } from "@/components/UI/DuplicateWorkWarning/DuplicateWorkWarning";
import { FormProgress } from "@/components/UI/Form/Progress";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useCurrentChain } from "@/hooks/useChainConfig";
import { defaultDeduplicationManager } from "@/modules/deduplication";

import { useWork, WorkTab } from "@/providers/work";
import { WorkCompleted } from "./Completed";
import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";

const Work: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const chainId = useCurrentChain();
  const { gardens, actions, form, activeTab, setActiveTab, workMutation } = useWork();

  // State for duplicate warning modal
  const [duplicateWarning, setDuplicateWarning] = useState<{
    workData: any;
    duplicateInfo: any;
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

  const { status } = workMutation;

  const garden = gardens.find((garden) => garden.id === gardenAddress);
  // Match action by numeric UID to the JSON mapping; remove chain ID coupling for form inputs and review
  const action = actions.find((action) => {
    if (!actionUID) return false;
    const idPart = action.id?.split("-").pop();
    const numeric = Number(idPart);
    return Number.isFinite(numeric) && numeric === actionUID;
  });

  // Enhanced upload function with duplicate detection
  const handleWorkSubmission = async (): Promise<boolean> => {
    if (!gardenAddress || !actionUID || !action) return false;

    // Check for duplicates first
    const workData = {
      type: "work",
      chainId,
      data: {
        feedback,
        plantSelection,
        plantCount,
        title: `${action.title} - ${new Date().toISOString()}`,
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
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      // Proceed with submission if duplicate check fails
      uploadWork();
      return true;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
        return (
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
          <WorkDetails
            instruction={intl.formatMessage({
              id: "app.garden.submit.tab.details.instruction",
              defaultMessage: "Provide detailed information and feedback",
            })}
            feedbackPlaceholder=""
            inputs={action?.inputs ?? []}
            register={register}
            control={control}
          />
        );
      case WorkTab.Review:
        if (!garden || !action)
          return (
            <div className="p-4 text-sm text-slate-600">
              {intl.formatMessage({
                id: "app.garden.submit.tab.review.loading",
                defaultMessage: "Loading review details...",
              })}
            </div>
          );
        return (
          <WorkReview
            instruction={intl.formatMessage({
              id: "app.garden.submit.tab.review.instruction",
              defaultMessage: "Check if the information is correct",
            })}
            garden={garden}
            action={action}
            images={images}
            values={form.values}
            feedback={feedback}
            plantCount={plantCount}
            plantSelection={plantSelection}
          />
        );
      case WorkTab.Complete:
        return <WorkCompleted status={status} garden={garden!} mutationData={workMutation.data} />;
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
          changeTab(WorkTab.Complete);
          form.reset();
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
    [WorkTab.Complete]: {
      primary: () => {
        workMutation.reset();
        form.reset();
        setImages([]);
        changeTab(WorkTab.Intro);
        navigate("/home");
      },
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.complete.label",
        defaultMessage: "Finish",
      }),
      primaryDisabled: workMutation.isPending,
      secondary: null,
      backButton: undefined,
    },
  };

  return (
    <>
      <TopNav onBackClick={tabActions[activeTab].backButton} overlay>
        <FormProgress
          currentStep={Object.values(WorkTab).indexOf(activeTab) + 1}
          steps={Object.values(WorkTab).slice(0, 4)}
        />
      </TopNav>
      <Form
        id="work-form"
        control={control}
        className="relative py-6 pt-16 flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
      >
        <div className="padded relative flex flex-col gap-4 flex-1">{renderTabContent()}</div>
        <div className="flex fixed left-0 bottom-0 py-3 w-full z-[10000] bg-white border-t border-stroke-soft-200">
          <div className="flex flex-row gap-4 w-full mt-4 padded">
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
      </Form>

      {/* Duplicate Work Warning Modal */}
      {duplicateWarning && (
        <DuplicateWorkWarning
          workData={duplicateWarning.workData}
          duplicateInfo={duplicateWarning.duplicateInfo}
          onProceed={() => {
            setDuplicateWarning(null);
            uploadWork();
            changeTab(WorkTab.Complete);
            form.reset();
          }}
          onCancel={() => {
            setDuplicateWarning(null);
          }}
          onViewDuplicate={(workId: string) => {
            // Navigate to view the existing work
            setDuplicateWarning(null);
            navigate(`/home/${gardenAddress}/work/${workId}`);
          }}
        />
      )}
    </>
  );
};

export default Work;
