import { RiFileFill, RiHammerFill, RiLeafFill, RiPencilFill, RiPlantFill } from "@remixicon/react";
import { useIntl } from "react-intl";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/UI/Carousel/Carousel";
import { FormCard } from "@/components/UI/Form/Card";
import { FormInfo } from "@/components/UI/Form/Info";

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
  const intl = useIntl();
  return (
    <div className="flex flex-col gap-4">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.review.title",
          defaultMessage: "Review Work",
        })}
        info={instruction}
        Icon={RiFileFill}
      />
      <h6>
        {intl.formatMessage({
          id: "app.garden.review.garden",
          defaultMessage: "Garden",
        })}
      </h6>
      <GardenCard
        garden={garden}
        selected={false}
        showDescription={false}
        showOperators={true}
        showBanner={false}
      />
      {images.length > 0 && (
        <>
          <h6>
            {intl.formatMessage({
              id: "app.garden.review.media",
              defaultMessage: "Media",
            })}
          </h6>
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
                    className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </>
      )}
      <h6>
        {intl.formatMessage({
          id: "app.garden.review.details",
          defaultMessage: "Details",
        })}
      </h6>
      <FormCard
        label={intl.formatMessage({
          id: "app.garden.review.action",
          defaultMessage: "Action",
        })}
        value={action.title}
        Icon={RiHammerFill}
      />
      <FormCard
        label={intl.formatMessage({
          id: "app.garden.review.plantTypes",
          defaultMessage: "Plant Types",
        })}
        value={plantSelection.join(", ")}
        Icon={RiPlantFill}
      />
      {feedback && (
        <FormCard
          label={intl.formatMessage({
            id: "app.garden.review.description",
            defaultMessage: "Description",
          })}
          value={feedback}
          Icon={RiPencilFill}
        />
      )}
      <FormCard
        label={intl.formatMessage({
          id: "app.garden.review.plantAmount",
          defaultMessage: "Plant Amount",
        })}
        value={plantCount.toString()}
        Icon={RiLeafFill}
      />
    </div>
  );
};
