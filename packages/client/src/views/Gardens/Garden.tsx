import {
  RiMapPin2Fill,
  RiArrowLeftSLine,
  RiCalendarEventFill,
  RiNotificationFill,
} from "@remixicon/react";
import React, { useState } from "react";
import { useParams, Link, Outlet, useLocation } from "react-router-dom";

import { useGarden, useGardens } from "@/providers/garden";

import { CircleLoader } from "@/components/Loader";
import { GardenWork } from "@/components/Garden/Work";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { GardenAssessments } from "@/components/Garden/Asessments";
import { GardenNotifications } from "./Notifications";

enum GardenTab {
  Work = "work",
  Assessments = "assessments",
  Gardeners = "gardeners",
}

interface GardenProps {}

export const Garden: React.FC<GardenProps> = () => {
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Work);

  const { id } = useParams<{
    id: string;
  }>();
  const { pathname } = useLocation();

  const { actions } = useGardens();
  const { garden, gardeners } = useGarden(id!);

  if (!garden)
    return (
      <main className="w-full h-full grid place-items-center">
        <CircleLoader />;
      </main>
    );

  const { name, bannerImage, location, createdAt, assessments, works } = garden;

  const workNotifications = works.filter((work) => work.status === "pending");

  const renderTabContent = () => {
    switch (activeTab) {
      case GardenTab.Work:
        return <GardenWork actions={actions} works={works} />;
      case GardenTab.Assessments:
        return <GardenAssessments assessments={assessments} />;
      case GardenTab.Gardeners:
        return <GardenGardeners gardeners={gardeners} />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute left-0 top-0 h-full w-full flex flex-col">
      {pathname.includes("work") || pathname.includes("assessments") ? null : (
        <>
          <div>
            <div className="flex gap-1 items-center justify-between absolute top-4 left-4 right-4">
              <Link
                className="flex gap-1 items-center w-10 h-10 p-2 bg-white rounded-lg"
                to="/gardens"
              >
                <RiArrowLeftSLine className="w-10 h-10 text-black" />
              </Link>
              <div className="relative dropdown dropdown-bottom dropdown-end">
                {workNotifications.length ?
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-teal-500 rounded-full flex-col justify-center items-center gap-2.5 inline-flex">
                    <p className="text-xs self-stretch text-center text-white font-medium leading-3 tracking-tight">
                      {workNotifications.length}
                    </p>
                  </span>
                : null}
                <div
                  tabIndex={0}
                  role="button"
                  className="flex items-center gap-1  w-10 h-10 p-2 bg-white rounded-lg "
                >
                  <RiNotificationFill />
                </div>
                <GardenNotifications
                  garden={garden}
                  notifications={workNotifications}
                />
              </div>
            </div>
            <img
              src={bannerImage}
              className="w-full object-cover object-top aspect-[16/9] border-b-2 border-slate-300 shadow-sm rounded-b-3xl"
              alt="Banner"
            />
          </div>
          <div className="px-4 py-1">
            <h4 className="line-clamp-1">{name}</h4>
            <div className="flex w-full justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1 font-bold">
                  <RiMapPin2Fill className="h-5 text-teal-400" />
                  <span className="text-sm">Location: {location}</span>
                </div>
                <div className="flex gap-1 font-bold">
                  <RiCalendarEventFill className="h-5 text-teal-400" />
                  <span className="text-sm">
                    Founded: {createdAt.toDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <ul className="mx-4 flex items-center flex-nowrap border border-slate-100 overflow-hidden shadow-sm rounded-lg divide-x-2">
            {Object.values(GardenTab).map((tab) => (
              <li
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex justify-center items-center p-3 cursor-pointer ${tab === activeTab ? "bg-teal-200 " : ""} transition-colors duration-200`}
              >
                <label className="capitalize small font-semibold text-center w-full">
                  {tab}
                </label>
              </li>
            ))}
          </ul>
          <div className="noscroll px-4 pt-4 flex-1 overflow-y-scroll flex flex-col gap-2 pb-20">
            {renderTabContent()}
          </div>
        </>
      )}
      <Outlet context={{ gardenId: garden.id }} />
    </div>
  );
};
