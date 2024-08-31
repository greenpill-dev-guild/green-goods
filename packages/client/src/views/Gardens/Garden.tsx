import {
  RiMapPin2Fill,
  RiArrowLeftFill,
  RiCalendarEventFill,
  RiProfileFill,
  // RiThumbUpFill,
  // PencilLineIcon,
} from "@remixicon/react";
import React, { useState } from "react";
import { useParams } from "react-router-dom";

import { formatAddress } from "@/utils/text";

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

  if (!garden) return <CircleLoader />;

  const { name, bannerImage, location, operators, gardenAssessments } = garden;

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
    <div className="h-full overflow-y-scroll flex flex-col">
      <div className="relative w-full">
        <a
          className="flex gap-1 items-center h-8 px-2 py-1 bg-white rounded-lg font-bold absolute top-0 left-0"
          href="/proposals"
        >
          <RiArrowLeftFill className="h-8" />
          Back
        </a>
        <img
          src={bannerImage}
          className="w-full object-cover object-top aspect-[16/9] border-b-2 border-slate-300 shadow-sm"
          alt="Banner"
        />
      </div>
      <div className="px-4 py-2">
        <h2 className="text-xl font-semibold line-clamp-2 mb-2">{name}</h2>
        <div className="flex w-full justify-between items-start mb-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <RiProfileFill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">
                {operators
                  .map((operator) => formatAddress(operator))
                  .join(", ")}
              </span>
            </div>
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
      <div>
        <ul>
          {Object.values(GardenTab).map((tab) => (
            <li
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontWeight: activeTab === tab ? "bold" : "normal",
                cursor: "pointer",
              }}
            >
              {tab}
            </li>
          ))}
        </ul>
        {renderTabContent()}
      </div>
    </div>
  );
};
