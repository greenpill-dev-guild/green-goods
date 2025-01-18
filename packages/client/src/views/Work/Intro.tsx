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
      <div className="carousel carousel-center rounded-box max-w-md space-x-4 p-4">
        {actions.map((action) => (
          <li
            key={action.id}
            className={`carousel-item flex flex-col gap-2 border-2 shadow w-2/3 rounded-xl ${
              action.id === selectedActionUID ?
                "active border-green-600"
              : "border-transparent"
            }`}
            onClick={() => setActionUID(action.id)}
          >
            <img
              src={action.media[0]}
              alt={"Action image"}
              className="aspect-square object-cover rounded-xl"
            />
            <h5>{action.title}</h5>
          </li>
        ))}
      </div>
      <FormInfo
        title="Select your garden"
        info="Which garden are you submitting for?"
        Icon={RiPlantFill}
      />
      <ul className="carousel carousel-center rounded-box max-w-md space-x-4 p-4">
        {gardens.map((garden) => (
          <li
            key={garden.id}
            className={`carousel-item flex flex-col border-2 w-2/3 ${
              garden.id === selectedGardenAddress ?
                "active border-green-600"
              : "border-transparent"
            }`}
            onClick={() => setGardenAddress(garden.id)}
          >
            <img src={garden.bannerImage} alt={"Garden banner image"} />
            <h5>{garden.name}</h5>
            <p>{garden.description}</p>
          </li>
        ))}
        {gardens.length < 2 && (
          <li className="carousel-item flex flex-col w-2/3">
            <div className="divider"></div>
          </li>
        )}
      </ul>
    </>
  );
};
