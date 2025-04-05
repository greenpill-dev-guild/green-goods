import { RiMapPin2Fill, RiCalendarEventFill } from "@remixicon/react";
import React, { useState } from "react";
import { useParams, Outlet, useLocation } from "react-router-dom";

import { useGarden, useGardens } from "@/providers/garden";

import { CircleLoader } from "@/components/Loader";
import { GardenWork } from "@/components/Garden/Work";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { GardenAssessments } from "@/components/Garden/Asessments";
import { Tabs, TabsList, TabsTrigger } from "@/components/UI/Tabs/Tabs";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useNavigateToTop } from "@/utils/useNavigateToTop";

enum GardenTab {
  Work = "work",
  Assessments = "assessments",
  Gardeners = "gardeners",
}

interface GardenProps {}

export const Garden: React.FC<GardenProps> = () => {
  const navigate = useNavigateToTop();
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Work);

  const { id } = useParams<{
    id: string;
  }>();
  const { pathname } = useLocation();

  const { actions } = useGardens();
  const { garden, gardenStatus, gardeners, isFetching } = useGarden(id!);

  if (!garden)
    return (
      <main className="w-full h-full grid place-items-center">
        <CircleLoader />
      </main>
    );

  const { name, bannerImage, location, createdAt, assessments, works } = garden;

  const renderTabContent = () => {
    switch (activeTab) {
      case GardenTab.Work:
        return (
          <GardenWork
            workFetchStatus={isFetching ? "pending" : gardenStatus}
            actions={actions}
            works={works}
          />
        );
      case GardenTab.Assessments:
        return (
          <GardenAssessments
            asessmentFetchStatus={isFetching ? "pending" : gardenStatus}
            assessments={assessments}
          />
        );
      case GardenTab.Gardeners:
        return <GardenGardeners gardeners={gardeners} />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {pathname.includes("work") || pathname.includes("assessments") ? null : (
        <>
          <div className="fixed top-0 left-0 right-0 w-full bg-white z-10">
            <TopNav
              className="absolute top-0 left-0 flex w-full justify-between items-center p-4"
              onBackClick={() => navigate("/home")}
              works={works}
              garden={garden}
            />
            <img
              src={bannerImage}
              className="w-full object-cover object-center rounded-b-3xl max-h-44"
              alt="Banner"
            />
            <div className="padded mt-2 flex flex-col gap-1">
              <h5 className="line-clamp-1">{name}</h5>
              <div className="flex w-full justify-between items-start mb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row gap-1 items-center">
                    <RiMapPin2Fill className="h-4 text-primary" />
                    <div className="text-xs">
                      <span className="font-medium">Location •</span> {location}
                    </div>
                  </div>
                  <div className="flex flex-row gap-1 items-center">
                    <RiCalendarEventFill className="h-4 text-primary" />
                    <div className="text-xs">
                      <span className="font-medium">Founded •</span>{" "}
                      {createdAt.toDateString()}
                    </div>
                  </div>
                </div>
              </div>
              <Tabs value={activeTab}>
                <TabsList>
                  {Object.values(GardenTab).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex justify-center items-center p-3 cursor-pointer ${tab === activeTab ? "bg-teal-200 " : ""} transition-colors duration-200`}
                    >
                      <div className="capitalize small font-semibold text-center w-full">
                        {tab}
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="padded flex-1 flex flex-col gap-4 pt-80 pb-4">
            {renderTabContent()}
          </div>
        </>
      )}
      <Outlet context={{ gardenId: garden.id }} />
    </div>
  );
};
