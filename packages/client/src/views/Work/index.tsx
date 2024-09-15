import { Link } from "react-router-dom";
import { RiArrowGoBackLine } from "@remixicon/react";

import { useWork, WorkTab } from "@/providers/WorkProvider";
import { Button } from "@/components/Button";

import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkDetails } from "./Details";
import { WorkReview } from "./Review";

interface WorkProps {}

const actionContent = {
  [WorkTab.Intro]: {
    primary: null,
    secondary: "Cancel",
  },
  [WorkTab.Media]: {
    primary: "Enter Details",
    secondary: "Back To Actions",
  },
  [WorkTab.Details]: {
    primary: "Review",
    secondary: "Back To Media",
  },
  [WorkTab.Review]: {
    primary: "Upload Work",
    secondary: "Back To Details",
  },
};

const Work: React.FC<WorkProps> = () => {
  // const navigate = useNavigate();
  const { actions, form, activeTab, setActiveTab } = useWork();

  // const actionOnClick = {};

  if (!form) {
    return null;
  }

  const { images, setImages, actionUID, register, uploadWork } = form;
  const action = actions.find((action) => action.id === actionUID);

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
        return (
          <WorkIntro
            title="Select Action"
            description="From the list below select what you would like to ork on today."
          />
        );
      case WorkTab.Media:
        return <WorkMedia images={images} setImages={setImages} />;
      case WorkTab.Details:
        return (
          <WorkDetails
            title=""
            description={""}
            feedbackPlaceholder=""
            inputs={[]}
            register={register}
          />
        );
      case WorkTab.Review:
        return (
          <WorkReview
            title={action?.title!}
            description={action?.description!}
            feedback={action?.details.feedbackPlaceholder!}
            images={images}
            plantCount={0}
            plantSelection={[]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <form
      className="absolute top-0 left-0 z-40 bg-white flex flex-col h-full w-full pt-4 pb-4 px-4"
      onSubmit={uploadWork}
    >
      <div>
        <Link
          className="flex gap-1 items-center w-10 h-10 p-2 bg-white rounded-lg font-bold"
          to="/gardens"
        >
          <RiArrowGoBackLine className="w-10 h-10 text-black" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-scroll">{renderTabContent()}</div>
      <div className="flex gap-2 flex-nowrap">
        {actionContent[activeTab].secondary && (
          <Button
            fullWidth
            label={actionContent[activeTab].secondary}
            onClick={() => setActiveTab(WorkTab.Media)}
          />
        )}
        {actionContent[activeTab].primary && (
          <Button
            fullWidth
            label={actionContent[activeTab].primary}
            onClick={() => setActiveTab(WorkTab.Review)}
          />
        )}
      </div>
    </form>
  );
};

export default Work;
