import type React from "react";
import { RiHammerFill, RiPlantFill } from "@remixicon/react";

import { FormInfo } from "@/components/UI/Form/Info";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/UI/Carousel/Carousel";
import { ActionCard } from "@/components/UI/Card/ActionCard";
import { GardenCard } from "@/components/UI/Card/GardenCard";

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
  return (
    <>
      <FormInfo
        title="Select your action"
        info="What type of work you are submitting?"
        Icon={RiHammerFill}
      />
      <Carousel opts={{ align: "start"}}>
        <CarouselContent>
          {actions.map((action) => (
            <CarouselItem
              key={action.id}
              onClick={() => setActionUID(action.id)}
            >
              <ActionCard action={action} selected={selectedActionUID === action.id} media="large" />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <FormInfo
        title="Select your garden"
        info="Which garden are you submitting for?"
        Icon={RiPlantFill}
      />
      <Carousel>
        <CarouselContent>
          {gardens.map((garden) => (
            <CarouselItem
              key={garden.id}
              onClick={() => setGardenAddress(garden.id)}
            >
              <GardenCard garden={garden} selected={garden.id === selectedGardenAddress} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </>
  );
};
