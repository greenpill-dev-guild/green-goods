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
import { formatAddress } from "@/utils/text";

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
      <h5 className="mb-1">Garden</h5>
      <div className="mb-4 flex flex-col gap-1 shadow-md p-4 border-2 border-slate-100 rounded-2xl">
        <h5 className="text-2xl">{garden.name}</h5>
        <div>
          <div className="flex gap-0.5">
            <RiGroupFill className="h-4 text-teal-500" />
            <p className="text-sm">{garden.gardeners.length} Gardeners</p>
          </div>
          <div className="flex gap-0.5">
            <RiMapFill className="h-4 text-teal-500" />
            <p className="text-sm">{garden.location}</p>
          </div>
        </div>
        <div>
          <p className="text-sm mb-0.5">OPERATORS</p>
          <ul className="flex flex-wrap gap-1">
            {garden.operators.map((operator) => (
              <li
                key={operator}
                className="text-xs border border-slate-200 rounded-xl py-1 px-1.5 "
              >
                {formatAddress(operator)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h5 className="mb-1">Media</h5>
      <ul className="mb-4 carousel carousel-center max-w-md space-x-4">
        {images.map((file, index) => (
          <div key={index} className="carousel-item w-1/2">
            <img
              src={URL.createObjectURL(file)}
              alt={`Preview ${index}`}
              className="w-full aspect-[3/4] object-cover rounded-2xl"
            />
          </div>
        ))}
      </ul>
      <h5 className="mb-1">Details</h5>
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
