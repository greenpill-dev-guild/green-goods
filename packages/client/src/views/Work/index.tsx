import { useState } from "react";

import { useWork } from "@/providers/WorkProvider";

import { WorkMedia } from "./Media";
import { WorkDetails } from "./Details";
import { WorkReview } from "./Review";

interface WorkProps {}

enum WorkTab {
  Media = "Media",
  Details = "Details",
  Review = "Review",
}

const Work: React.FC<WorkProps> = () => {
  const { actions, form } = useWork();
  const [activeTab, setActiveTab] = useState(WorkTab.Media);

  if (!form) {
    return null;
  }

  const { images, setImages, actionUID, register, uploadWork } = form;
  const action = actions.find((action) => action.id === actionUID);

  const renderTabContent = () => {
    switch (activeTab) {
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
        return <WorkReview />;
      default:
        return null;
    }
  };

  return (
    <form onSubmit={uploadWork}>
      {renderTabContent()}
      <div>
        {activeTab !== WorkTab.Media && (
          <button onClick={() => setActiveTab(WorkTab.Media)}>Back</button>
        )}
        {activeTab !== WorkTab.Review && (
          <button onClick={() => setActiveTab(WorkTab.Review)}>Next</button>
        )}
      </div>
    </form>
  );
};

export default Work;
