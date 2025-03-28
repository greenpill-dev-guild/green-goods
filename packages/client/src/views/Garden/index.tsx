import { Form } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiImage2Fill,
} from "@remixicon/react";

import { useWork, WorkTab } from "@/providers/work";

import { Button } from "@/components/UI/Button";
import { FormProgress } from "@/components/UI/Form/Progress";

import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkDetails } from "./Details";
import { WorkReview } from "./Review";
import { WorkCompleted } from "./Completed";

const Work: React.FC = () => {
  const navigate = useNavigate();
  const { gardens, actions, form, activeTab, setActiveTab, workMutation } =
    useWork();

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
        if (!garden || !action)
          return <div>Missing garden or action information</div>;
        return (
          <WorkReview
            instruction={"Check if your informations are correct"}
            garden={garden}
            action={action}
            images={images}
            feedback={feedback}
            plantCount={plantCount}
            plantSelection={plantSelection}
          />
        );
      case WorkTab.Complete:
        return <WorkCompleted workMutation={workMutation} garden={garden!} />;
    }
  };

  const changeTab = (tab: WorkTab) => {
    document
      .getElementById("work-form")
      ?.scrollIntoView({ behavior: "instant" });
    setActiveTab(tab);
  };

  const tabActions = {
    [WorkTab.Intro]: {
      primary: () => changeTab(WorkTab.Media),
      primaryLabel: "Start Gardening",
      primaryDisabled: !gardenAddress || typeof actionUID !== "number",
      secondary: null,
      backButton: () => navigate("/gardens"),
    },
    [WorkTab.Media]: {
      primary: () => changeTab(WorkTab.Details),
      primaryLabel: "Add Details",
      primaryDisabled: images.length < 2,
      secondary: () => document.getElementById("work-media-upload")?.click(),
      secondaryLabel: "Upload Media",
      backButton: () => changeTab(WorkTab.Intro),
    },
    [WorkTab.Details]: {
      primary: () => changeTab(WorkTab.Review),
      primaryLabel: "Review Work",
      primaryDisabled: !state.isValid,
      secondary: null,
      backButton: () => changeTab(WorkTab.Media),
    },
    [WorkTab.Review]: {
      primary: () => {
        changeTab(WorkTab.Complete);
        uploadWork();
      },
      primaryLabel: "Upload Work",
      primaryDisabled: !state.isValid || state.isSubmitting,
      secondary: null,
      backButton: () => changeTab(WorkTab.Details),
    },
    [WorkTab.Complete]: {
      primary: () => {
        navigate("/gardens");
      },
      primaryLabel: "Finish",
      primaryDisabled: workMutation.isPending,
      secondary: null,
      backButton: undefined,
    },
  };

  return (
    <Form
      id="work-form"
      control={control}
      className="relative py-6 flex flex-col gap-4 min-h-screen"
    >
      <div className="padded relative flex flex-col gap-4">
        <div className="relative flex flex-row w-full  justify-between items-center">
          <Button
            variant="neutral"
            mode="stroke"
            type="button"
            shape="pilled"
            size="xsmall"
            label=""
            leadingIcon={<RiArrowLeftLine className="w-4 h-4 text-black" />}
            onClick={(e) => {
              tabActions[activeTab].backButton?.();
              e.currentTarget.blur();
            }}
            className="p-0 px-2"
          />
          <FormProgress
            currentStep={Object.values(WorkTab).indexOf(activeTab) + 1}
            steps={Object.values(WorkTab).slice(0, 4)}
          />
          <div className="flex items-center gap-1 w-10 h-10 p-2 border border-transparent" />
        </div>
        {renderTabContent()}
        <div className="flex grow" />
      </div>
      <div className="flex border-t border-stroke-soft-200">
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
  );
};

export default Work;
