import {
  RiFileFill,
  RiGroupFill,
  RiHammerFill,
  RiLeafFill,
  RiMapFill,
  RiPencilFill,
  RiPlantFill,
} from "@remixicon/react";

import { FormInfo } from "@/components/UI/Form/Info";
import { FormCard } from "@/components/UI/Form/Card";
import { formatAddress } from "@/utils/text";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/UI/Carousel/Carousel";

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
    <div className="flex flex-col gap-4">
      <FormInfo title="Review Work" info={instruction} Icon={RiFileFill} />
      <h6>Garden</h6>
      <GardenCard
        garden={garden}
        selected={false}
        showDescription={false}
        showOperators={true}
        showBanner={false}
      />
      {images.length > 0 && (
        <>
          <h6>Media</h6>
          <Carousel>
            <CarouselContent>
              {images.map((file, index) => (
                <CarouselItem
                  key={file.name}
                  className="max-w-40 aspect-3/4 object-cover rounded-2xl "
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index}`}
                    className="w-full aspect-3/4 object-cover rounded-2xl"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </>
      )}
      <h6>Details</h6>
      <FormCard label="Action" value={action.title} Icon={RiHammerFill} />
      <FormCard
        label="Plant Types"
        value={plantSelection.join(", ")}
        Icon={RiPlantFill}
      />
      {feedback && (
        <FormCard label="Description" value={feedback} Icon={RiPencilFill} />
      )}
      <FormCard
        label="Plant Amount"
        value={plantCount.toString()}
        Icon={RiLeafFill}
      />
    </div>
  );
};
