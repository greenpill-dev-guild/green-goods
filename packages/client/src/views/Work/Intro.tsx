import React from "react";
import { RiHammerFill, RiPlantFill } from "@remixicon/react";

import { FormInfo } from "@/components/Form/Info";

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
      <div className="carousel carousel-center max-w-md space-x-4 mb-4">
        {actions.map((action) => (
          <li
            key={action.id}
            className={`carousel-item flex flex-col border shadow-sm  w-2/3 rounded-xl ${
              action.id === selectedActionUID ?
                "active border-green-600"
              : "border-slate-200"
            }`}
            onClick={() => setActionUID(action.id)}
          >
            <img
              src={action.media[0]}
              alt={"Action image"}
              className="aspect-video object-cover rounded-t-xl"
            />
            <div className="p-2">
              <h5 className="text-xl font-medium">{action.title}</h5>
            </div>
          </li>
        ))}
      </div>
      <FormInfo
        title="Select your garden"
        info="Which garden are you submitting for?"
        Icon={RiPlantFill}
      />
      <ul className="carousel carousel-center max-w-md space-x-4 mb-4">
        {gardens.map((garden) => (
          <li
            key={garden.id}
            className={`carousel-item flex flex-col border shadow-sm  w-2/3 rounded-xl ${
              garden.id === selectedGardenAddress ?
                "active border-green-600"
              : "border-transparent"
            }`}
            onClick={() => setGardenAddress(garden.id)}
          >
            <img
              src={garden.bannerImage}
              alt={"Garden banner image"}
              className="aspect-video object-cover rounded-t-xl"
            />
            <div className="p-2">
              <h5 className="text-xl font-medium">{garden.name}</h5>
              <p className="text-xs line-clamp-3">{garden.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};
