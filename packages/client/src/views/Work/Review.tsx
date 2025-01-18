import {
  RiFileFill,
  RiGroupFill,
  RiHammerFill,
  RiLeafFill,
  RiMapFill,
  RiPencilFill,
  RiPlantFill,
} from "@remixicon/react";

import { FormInfo } from "@/components/Form/Info";
import { FormCard } from "@/components/Form/Card";

interface WorkReviewProps {
  instruction: string;
  garden: Garden;
  action: Action;
  images: File[];
  plantSelection: string[];
  plantCount: number;
  feedback: string;
}

export const WorkReview: React.FC<WorkReviewProps> = ({
  action,
  garden,
  instruction,
  images,
  plantSelection,
  plantCount,
  feedback,
}) => {
  return (
    <div>
      <FormInfo title="Review Work" info={instruction} Icon={RiFileFill} />
      <h5>Garden</h5>
      <div>
        <h5>{garden.name}</h5>
        <div className="flex">
          <div>
            <RiGroupFill size={12} />
            <p>{garden.gardeners.length} Gardeners</p>
          </div>
          <div>
            <RiMapFill size={12} />
            <p>{garden.location}</p>
          </div>
        </div>
      </div>
      <h5>Media</h5>
      <ul className="carousel carousel-center rounded-box max-w-md space-x-4 p-4">
        {images.map((file, index) => (
          <div key={index} className="carousel-item w-2/3">
            <img
              src={URL.createObjectURL(file)}
              alt={`Preview ${index}`}
              className="w-full h-64 object-cover"
            />
          </div>
        ))}
      </ul>
      <h5>Details</h5>
      <FormCard label="Action" value={action.title} Icon={RiHammerFill} />
      <FormCard
        label="Plant Selection"
        value={plantSelection.join(", ")}
        Icon={RiPlantFill}
      />
      <FormCard
        label="Plant Count"
        value={plantCount.toString()}
        Icon={RiLeafFill}
      />
      <FormCard label="Feedback" value={feedback} Icon={RiPencilFill} />
    </div>
  );
};
