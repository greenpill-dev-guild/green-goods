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
  values: Record<string, unknown>;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
}

export const WorkReview: React.FC<WorkReviewProps> = ({
  action,
  garden,
  instruction,
  images,
  values,
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
        height="selection"
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
      {/* Render dynamic inputs based on action.inputs */}
      {action.inputs
        .map((input) => {
          const raw = values?.[input.key];
          if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
            return null;
          }
          let display: string = "";
          if (Array.isArray(raw)) {
            display = raw.join(", ");
          } else if (typeof raw === "number") {
            display = String(raw);
          } else if (typeof raw === "string") {
            display = raw;
          } else {
            display = JSON.stringify(raw);
          }
          return <FormCard key={input.key} label={input.title} value={display} Icon={RiFileFill} />;
        })
        .filter(Boolean)}
      {feedback && feedback.trim().length > 0 && (
        <FormCard
          label={intl.formatMessage({
            id: "app.garden.review.description",
            defaultMessage: "Description",
          })}
          value={feedback}
          Icon={RiPencilFill}
        />
      )}
    </div>
  );
};
