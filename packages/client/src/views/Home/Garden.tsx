import { RiMapPin2Fill, RiCalendarEventFill } from "@remixicon/react";
import React, { useState, useRef, useEffect } from "react";
import { useParams, Outlet, useLocation } from "react-router-dom";

import { useGarden, useGardens } from "@/providers/garden";

import { CircleLoader } from "@/components/UI/Loader";
import { GardenWork } from "@/components/Garden/Work";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { GardenAssessments } from "@/components/Garden/Asessments";
import { Tabs, TabsList, TabsTrigger } from "@/components/UI/Tabs/Tabs";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { useIntl } from "react-intl";

interface GardenProps {}

export const Garden: React.FC<GardenProps> = () => {
  const intl = useIntl();

  enum GardenTab {
    Work = "work",
    Assessments = "assessments",
    Gardeners = "gardeners",
  }

  const tabNames = {
    [GardenTab.Work]: intl.formatMessage({
      id: "app.garden.work",
      defaultMessage: "Work",
    }),
    [GardenTab.Assessments]: intl.formatMessage({
      id: "app.garden.assessments",
      defaultMessage: "Assessments",
    }),
    [GardenTab.Gardeners]: intl.formatMessage({
      id: "app.garden.gardeners",
      defaultMessage: "Gardeners",
    }),
  };

  const navigate = useNavigateToTop();
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Work);
  const [scrollPositions, setScrollPositions] = useState({
    [GardenTab.Work]: 0,
    [GardenTab.Assessments]: 0,
    [GardenTab.Gardeners]: 0,
  });

  // Refs for each tab's scrollable container
  const tabRefs = {
    [GardenTab.Work]: useRef<HTMLUListElement>(null),
    [GardenTab.Assessments]: useRef<HTMLUListElement>(null),
    [GardenTab.Gardeners]: useRef<HTMLUListElement>(null),
  };

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

  // Save scroll position on scroll event for the active tab
  const handleScroll = (tab: GardenTab) => (event: React.UIEvent<HTMLUListElement, UIEvent>) => {
    setScrollPositions((prev) => ({
      ...prev,
      [tab]: event.currentTarget.scrollTop,
    }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case GardenTab.Work:
        return (
          <GardenWork
            ref={tabRefs[GardenTab.Work]}
            workFetchStatus={isFetching ? "pending" : gardenStatus}
            actions={actions}
            works={works}
            handleScroll={handleScroll(GardenTab.Work)}
          />
        );
      case GardenTab.Assessments:
        return (
          <GardenAssessments
            ref={tabRefs[GardenTab.Assessments]}
            asessmentFetchStatus={isFetching ? "pending" : gardenStatus}
            assessments={assessments}
            handleScroll={handleScroll(GardenTab.Assessments)}
          />
        );
      case GardenTab.Gardeners:
        return (
          <GardenGardeners
            ref={tabRefs[GardenTab.Gardeners]}
            gardeners={gardeners}
            handleScroll={handleScroll(GardenTab.Gardeners)}
          />
        );
    }
  };

  // Restore scroll position when switching tabs
  useEffect(() => {
    const currentRef = tabRefs[activeTab].current;
    if (currentRef) {
      currentRef.scrollTop = scrollPositions[activeTab];
    }
  }, [activeTab, scrollPositions, tabRefs]);

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
                      <span className="font-medium">
                        {intl.formatMessage({
                          id: "app.home.location",
                          description: "Location",
                        })}{" "}
                        •
                      </span>{" "}
                      {location}
                    </div>
                  </div>
                  <div className="flex flex-row gap-1 items-center">
                    <RiCalendarEventFill className="h-4 text-primary" />
                    <div className="text-xs">
                      <span className="font-medium">
                        {intl.formatMessage({
                          id: "app.home.founded",
                          description: "Founded",
                        })}{" "}
                        •
                      </span>{" "}
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
                        {tabNames[tab]}
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="padded flex-1 flex flex-col gap-4 pt-80 pb-4">{renderTabContent()}</div>
        </>
      )}
      <Outlet context={{ gardenId: garden.id }} />
    </div>
  );
};
