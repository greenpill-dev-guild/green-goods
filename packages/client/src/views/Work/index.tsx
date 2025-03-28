import { Form } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { RiArrowLeftSLine } from "@remixicon/react";

import { useWork, WorkTab } from "@/providers/work";

import { Button } from "@/components/Button";
import { FormProgress } from "@/components/Form/Progress";

import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkDetails } from "./Details";
import { WorkReview } from "./Review";

interface WorkProps {}

const Work: React.FC<WorkProps> = () => {
  const navigate = useNavigate();
  const { gardens, actions, form, activeTab, setActiveTab } = useWork();

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

  const garden = gardens.find((garden) => garden.id === gardenAddress);
  const action = actions.find((action) => action.id === actionUID);

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
            instruction="Please take a clear photo of the plants on the garden"
            needed={["whole_plant"]}
            optional={["leaves", "flowers", "fruits", "bark"]}
            images={images}
            setImages={setImages}
          />
        );
      case WorkTab.Details:
        return (
          <WorkDetails
            instruction="Provide detailed information and feedback"
            feedbackPlaceholder=""
            inputs={action?.inputs ?? []}
            register={register}
            control={control}
          />
        );
      case WorkTab.Review:
        return (
          <WorkReview
            instruction={"Check if your informations are correct"}
            garden={garden!}
            action={action!}
            images={images}
            feedback={feedback}
            plantCount={plantCount}
            plantSelection={plantSelection}
          />
        );
      case WorkTab.Complete:
        return (
          <div>
            <p>Work completed</p>
          </div>
        );
    }
  };

  const tabActions = {
    [WorkTab.Intro]: {
      primary: () => setActiveTab(WorkTab.Media),
      primaryLabel: "Start Gardening",
      primaryDisabled: !gardenAddress || typeof actionUID !== "number",
      secondary: null,
      backButton: () => navigate("/gardens"),
    },
    [WorkTab.Media]: {
      primary: () => setActiveTab(WorkTab.Details),
      primaryLabel: "Add Details",
      primaryDisabled: images.length < 2,
      secondary: () => document.getElementById("work-media-upload")?.click(),
      secondaryLabel: "Upload Media",
      backButton: () => setActiveTab(WorkTab.Intro),
    },
    [WorkTab.Details]: {
      primary: () => setActiveTab(WorkTab.Review),
      primaryLabel: "Review Work",
      primaryDisabled: !state.isValid,
      secondary: null,
      backButton: () => setActiveTab(WorkTab.Media),
    },
    [WorkTab.Review]: {
      primary: () => {
        uploadWork();
      },
      primaryLabel: "Upload Work",
      primaryDisabled: !state.isValid || state.isSubmitting,
      secondary: null,
      backButton: () => setActiveTab(WorkTab.Details),
    },
    [WorkTab.Complete]: {
      primary: () => navigate("/gardens"),
      primaryLabel: "Go to Gardens",
      primaryDisabled: false,
      secondary: null,
      backButton: undefined,
    },
  };

  return (
    <Form
      id="work-form"
      control={control}
      className="fixed top-0 left-0 right-0 bottom-0 z-40 bg-white flex flex-col w-full pt-4 pb-4 px-4"
    >
      <div className="relative flex justify-between items-center">
        <button
          type="button"
          className="flex items-center gap-1 w-10 h-10 p-2 bg-white border border-slate-200 rounded-lg"
          onClick={tabActions[activeTab].backButton}
        >
          <RiArrowLeftSLine className="w-10 h-10 text-black" />
        </button>
        <FormProgress
          currentStep={Object.values(WorkTab).indexOf(activeTab) + 1}
          steps={Object.values(WorkTab).slice(0, 4)}
        />
        <div className="flex items-center gap-1 w-10 h-10 p-2 border border-transparent" />
      </div>
      <div className="flex-1 overflow-y-scroll noscroll mt-4 pb-4">
        {renderTabContent()}
      </div>
      <div className="flex gap-2 flex-nowrap">
        {tabActions[activeTab].secondary && (
          <Button
            fullWidth
            onClick={tabActions[activeTab].secondary}
            label={tabActions[activeTab].secondaryLabel}
            type="button"
          />
        )}
        <Button
          fullWidth
          onClick={tabActions[activeTab].primary}
          label={tabActions[activeTab].primaryLabel}
          disabled={tabActions[activeTab].primaryDisabled}
          type="button"
        />
      </div>
    </Form>
  );
};

export default Work;
