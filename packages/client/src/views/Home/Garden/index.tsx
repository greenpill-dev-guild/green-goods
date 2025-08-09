import {
  RiCalendarEventFill,
  RiFileChartFill,
  RiGroupFill,
  RiHammerFill,
  RiMapPin2Fill,
} from "@remixicon/react";
import React, { useEffect } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { GardenAssessments } from "@/components/Garden/Assessments";
import { GardenGardeners } from "@/components/Garden/Gardeners";
import { GardenWork } from "@/components/Garden/Work";
import { GardenErrorBoundary } from "@/components/UI/ErrorBoundary/ErrorBoundary";
import { CircleLoader } from "@/components/UI/Loader";
import { type StandardTab, StandardTabs } from "@/components/UI/Tabs";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useBrowserNavigation, useNavigateToTop } from "@/hooks";
import { GardenTab, useGardenTabs } from "@/hooks/useGardenTabs";
import { useGarden, useGardens } from "@/providers/garden";

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

  // Header uses CSS sticky; no JS height measurement needed

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

  // Restore scroll position when switching tabs

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
            {/* Banner with overlaid TopNav */}
            <div className="relative w-full">
              <img
                src={bannerImage}
                className="w-full object-cover object-center rounded-b-3xl h-44 md:h-52"
                alt={`${name} banner`}
                loading="eager"
                decoding="async"
              />
              <div className="absolute top-0 left-0 right-0 z-20">
                <TopNav
                  className="flex w-full justify-between items-center p-4 pt-6"
                  onBackClick={() => navigate("/home")}
                  works={works}
                  garden={garden}
                />
              </div>
            </div>

            {/* Title and meta below banner */}
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

            {/* Tabs can remain sticky for better UX */}
            <div className="sticky top-0 left-0 right-0 w-full bg-white z-10 shadow-sm">
              <StandardTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(tabId) => setActiveTab(tabId as GardenTab)}
                variant="compact"
                isLoading={isFetching}
              />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 px-4 md:px-6 pb-4 overflow-y-auto" aria-busy={isFetching}>
              {renderTabContent()}
            </div>
          </>
        )}
        <Outlet context={{ gardenId: garden.id }} />
      </div>
    </GardenErrorBoundary>
  );
};
