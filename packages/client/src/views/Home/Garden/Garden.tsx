import {
  RiCalendarEventFill,
  RiMapPin2Fill,
  RiHammerFill,
  RiFileChartFill,
  RiGroupFill,
} from "@remixicon/react";
import React, { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { GardenAssessments } from "@/components/Garden/Asessments";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { GardenWork } from "@/components/Garden/Work";
import { CircleLoader } from "@/components/UI/Loader";
import { StandardTabs, type StandardTab } from "@/components/UI/Tabs";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useGarden, useGardens } from "@/providers/garden";
import { useNavigateToTop, useBrowserNavigation } from "@/hooks";
import { useGardenTabs, GardenTab } from "@/hooks/useGardenTabs";
import { GardenErrorBoundary } from "@/components/UI/ErrorBoundary/ErrorBoundary";

type GardenProps = {};

export const Garden: React.FC<GardenProps> = () => {
  const intl = useIntl();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  const tabNames = {
    [GardenTab.Work]: intl.formatMessage({
      id: "app.garden.work",
      defaultMessage: "Work",
    }),
    [GardenTab.Reports]: intl.formatMessage({
      id: "app.garden.reports",
      defaultMessage: "Reports",
    }),
    [GardenTab.Gardeners]: intl.formatMessage({
      id: "app.garden.gardeners",
      defaultMessage: "Gardeners",
    }),
  };

  const navigate = useNavigateToTop();
  const { activeTab, setActiveTab, tabRefs, handleScroll, restoreScrollPosition } = useGardenTabs();

  // Header height management for responsive layout
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(280);

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

  // Update header height on mount and window resize
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, []);

  // Standard tabs configuration - removed counts
  const tabs: StandardTab[] = [
    {
      id: GardenTab.Work,
      label: tabNames[GardenTab.Work],
      icon: <RiHammerFill className="w-4 h-4" />,
    },
    {
      id: GardenTab.Reports,
      label: tabNames[GardenTab.Reports],
      icon: <RiFileChartFill className="w-4 h-4" />,
    },
    {
      id: GardenTab.Gardeners,
      label: tabNames[GardenTab.Gardeners],
      icon: <RiGroupFill className="w-4 h-4" />,
    },
  ];

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
      case GardenTab.Reports:
        return (
          <GardenAssessments
            ref={tabRefs[GardenTab.Reports]}
            asessmentFetchStatus={isFetching ? "pending" : gardenStatus}
            assessments={assessments}
            handleScroll={handleScroll(GardenTab.Reports)}
          />
        );
      case GardenTab.Gardeners:
        return (
          <GardenGardeners
            ref={tabRefs[GardenTab.Gardeners]}
            gardeners={gardeners}
            garden={garden}
            handleScroll={handleScroll(GardenTab.Gardeners)}
          />
        );
    }
  };

  // Restore scroll position when switching tabs
  useEffect(() => {
    restoreScrollPosition();
  }, [activeTab, restoreScrollPosition]);

  return (
    <GardenErrorBoundary>
      <div className="h-full w-full flex flex-col relative">
        {pathname.includes("work") || pathname.includes("assessments") ? null : (
          <>
            {/* Header with dynamic height tracking */}
            <div
              ref={headerRef}
              className="fixed top-0 left-0 right-0 w-full bg-white z-10 shadow-sm"
            >
              <TopNav
                className="absolute top-0 left-0 flex w-full justify-between items-center p-4"
                onBackClick={() => navigate("/home")}
                works={works}
                garden={garden}
              />
              <img
                src={bannerImage}
                className="w-full object-cover object-center rounded-b-3xl h-44 md:h-52"
                alt={`${name} banner`}
              />
              <div className="px-4 md:px-6 mt-3 flex flex-col gap-1.5">
                <h1 className="text-xl md:text-2xl font-semibold line-clamp-1">{name}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <RiMapPin2Fill className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{location}</span>
                  </div>
                  <span className="hidden sm:inline text-gray-400">•</span>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <RiCalendarEventFill className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>
                      {intl.formatMessage({ id: "app.home.founded" })}{" "}
                      {new Date(createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <StandardTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(tabId) => setActiveTab(tabId as GardenTab)}
                variant="compact"
                isLoading={isFetching}
              />
            </div>

            {/* Content area with dynamic padding */}
            <div
              className="flex-1 px-4 md:px-6 pb-4 overflow-hidden"
              style={{ paddingTop: `${headerHeight + 16}px` }}
            >
              {renderTabContent()}
            </div>
          </>
        )}
        <Outlet context={{ gardenId: garden.id }} />
      </div>
    </GardenErrorBoundary>
  );
};
