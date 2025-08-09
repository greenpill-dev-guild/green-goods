import { RiHammerFill, RiPlantFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { ActionCard } from "@/components/UI/Card/ActionCard";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/UI/Carousel/Carousel";
import { FormInfo } from "@/components/UI/Form/Info";

interface WorkIntroProps {
  actions: Action[];
  gardens: Garden[];
  selectedActionUID: number | null;
  selectedGardenAddress: string | null;
  setActionUID: React.Dispatch<React.SetStateAction<number | null>>;
  setGardenAddress: React.Dispatch<React.SetStateAction<string | null>>;
}

export const WorkIntro: React.FC<WorkIntroProps> = ({
  actions,
  gardens,
  selectedActionUID,
  selectedGardenAddress,
  setActionUID,
  setGardenAddress,
}) => {
  const intl = useIntl();
  const uidFromActionId = (id: string): number | null => {
    const last = id.split("-").pop();
    const n = Number(last);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select your action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {actions.map((action) => {
            const uid = uidFromActionId(action.id);
            return (
              <CarouselItem
                key={action.id}
                onClick={() => {
                  if (uid !== null) setActionUID(uid);
                }}
              >
                <ActionCard action={action} selected={selectedActionUID === uid} media="small" />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourGarden",
          defaultMessage: "Select your garden",
        })}
        info={intl.formatMessage({
          id: "app.garden.whichGarden",
          defaultMessage: "Which garden are you submitting for?",
        })}
        Icon={RiPlantFill}
      />
      <Carousel>
        <CarouselContent>
          {gardens.map((garden) => (
            <CarouselItem key={garden.id} onClick={() => setGardenAddress(garden.id)}>
              <GardenCard
                garden={garden}
                height="selection"
                selected={garden.id === selectedGardenAddress}
                showDescription={true}
                showOperators={false}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </>
  );
};
