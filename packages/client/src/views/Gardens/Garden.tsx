import {
  RiMapPin2Fill,
  RiArrowGoBackLine,
  RiCalendarEventFill,
  // RiProfileFill,
  // RiThumbUpFill,
  // PencilLineIcon,
} from "@remixicon/react";
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";

// import { formatAddress } from "@/utils/text";

import { useGarden } from "@/providers/GardenProvider";

import { CircleLoader } from "@/components/Loader";
import { GardenActions } from "@/components/Garden/Actions";
import { GardenAssessments } from "@/components/Garden/Asessments";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { useWork } from "@/providers/WorkProvider";

enum GardenTab {
  Actions = "actions",
  Assessments = "assessments",
  Gardeners = "gardeners",
}

interface GardenProps {}

export const cardStyles = "bg-white border rounded-xl shadow-sm";
export const cardTitleStyles = "text-base font-medium bg-teal-100 py-2 px-3";
export const cardContentStyles = "text-sm leading-1 mt-2 px-3 pb-2";

export const Garden: React.FC<GardenProps> = () => {
  const { id } = useParams<{
    id: string;
  }>();
  const { actions, gardens, gardeners } = useGarden();
  const { works } = useWork();
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Actions);

  const garden = gardens.find((garden) => garden.id === id);

  if (!garden)
    return (
      <main className="w-full h-full grid place-items-center">
        <CircleLoader />;
      </main>
    );

  const { name, bannerImage, location, gardenAssessments } = garden;

  const gardenWorks = works.filter((work) => work.gardenAddress === id);
  const gardenGardeners = gardeners.filter((gardener) =>
    garden.gardeners.includes(gardener.wallet?.address ?? "")
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case GardenTab.Actions:
        return <GardenActions actions={actions} works={gardenWorks} />;
      case GardenTab.Assessments:
        return <GardenAssessments assessments={gardenAssessments} />;
      case GardenTab.Gardeners:
        return <GardenGardeners gardeners={gardenGardeners} />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute left-0 top-0 h-full w-full flex flex-col">
      <div className="w-full">
        <Link
          className="flex gap-1 items-center w-10 h-10 p-2 bg-white rounded-lg font-bold absolute top-4 left-4"
          to="/gardens"
        >
          <RiArrowGoBackLine className="w-10 h-10 text-black" />
        </Link>
        <img
          src={bannerImage}
          className="w-full object-cover object-top aspect-[16/9] border-b-2 border-stone-300 shadow-sm rounded-b-3xl"
          alt="Banner"
        />
      </div>
      <div className="px-4 py-2">
        <h4 className="line-clamp-2 mb-2">{name}</h4>
        <div className="flex w-full justify-between items-start mb-2">
          <div className="flex flex-col gap-1">
            {/* <div className="flex gap-1">
              <RiProfileFill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">
                {operators
                  .map((operator) => formatAddress(operator))
                  .join(", ")}
              </span>
            </div> */}
            <div className="flex gap-1">
              <RiMapPin2Fill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">{location}</span>
            </div>
            <div className="flex gap-1">
              <RiCalendarEventFill className="h-5 text-teal-400" />
              {/* <span className="text-sm font-medium">
                {start_date && end_date ?
                  `${start_date.toLocaleDateString()} - ${end_date.toLocaleDateString()}`
                : "No timeline provided."}
              </span> */}
            </div>
          </div>
        </div>
      </div>
      <ul className="px-4 flex items-center flex-nowrap border border-stone-100 shadow-sm rounded-lg divide-x-2">
        {Object.values(GardenTab).map((tab) => (
          <li
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex justify-center items-center p-3 cursor-pointer ${tab === activeTab ? "bg-stone-100" : ""} transition-colors duration-200`}
          >
            <label className="capitalize small font-semibold text-center w-full">
              {tab}
            </label>
          </li>
        ))}
      </ul>
      <div className="px-4 flex-1 overflow-y-scroll flex flex-col gap-2 pb-20">
        {renderTabContent()}
      </div>
    </div>
  );
};
