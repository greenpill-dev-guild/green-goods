import {
  RiCalendarEventFill,
  RiFileChartFill,
  RiGroupFill,
  RiHammerFill,
  RiMapPin2Fill,
} from "@remixicon/react";
import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { GardenAssessments } from "@/components/Garden/Assessments";
import { GardenGardeners, type GardenMember } from "@/components/Garden/Gardeners";
import { GardenWork } from "@/components/Garden/Work";
import { GardenErrorBoundary } from "@/components/UI/ErrorBoundary/ErrorBoundary";
import { type StandardTab, StandardTabs } from "@/components/UI/Tabs";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import {
  GardenTab,
  useActions,
  useBrowserNavigation,
  useGardenTabs,
  useGardeners,
  useGardens,
  useNavigateToTop,
  useWorks,
} from "@green-goods/shared/hooks";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";

type GardenProps = {};

export const Garden: React.FC<GardenProps> = () => {
  const intl = useIntl();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Removed JS-based scroll toggling; use CSS-only containment instead

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
  const { activeTab, setActiveTab } = useGardenTabs();

  // Header uses CSS sticky; no JS height measurement needed

  const { id: gardenIdParam } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const chainId = DEFAULT_CHAIN_ID;
  const { data: allGardens = [] } = useGardens(chainId);
  const garden = allGardens.find((g) => g.id === gardenIdParam);
  const gardenStatus: "error" | "success" | "pending" = garden ? "success" : "pending";
  const isFetching = false;
  const { data: allGardeners = [] } = useGardeners();
  const { data: actions = [] } = useActions(chainId);
  const { works: mergedWorks } = useWorks(gardenIdParam || "");
  const members = useMemo<GardenMember[]>(() => {
    if (!garden) return [];

    const operatorSet = new Set((garden.operators ?? []).map((addr) => addr.toLowerCase()));
    const gardenerSet = new Set((garden.gardeners ?? []).map((addr) => addr.toLowerCase()));
    const seen = new Set<string>();
    const orderedAddresses: string[] = [];

    for (const list of [garden.operators ?? [], garden.gardeners ?? []]) {
      for (const address of list) {
        const normalized = address.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        orderedAddresses.push(address);
      }
    }

    const fallbackRegisteredAt = garden.createdAt ?? Date.now();

    return orderedAddresses.map((address) => {
      const normalized = address.toLowerCase();
      const match = allGardeners.find((g) => g.account?.toLowerCase() === normalized);

      return {
        id: match?.id || address,
        account: address,
        username: match?.username || undefined,
        email: match?.email || undefined,
        phone: match?.phone || undefined,
        avatar: match?.avatar || undefined,
        registeredAt: match?.registeredAt ?? fallbackRegisteredAt,
        isOperator: operatorSet.has(normalized),
        isGardener: gardenerSet.has(normalized),
      };
    });
  }, [allGardeners, garden]);

  if (!garden) return null;

  const { name, bannerImage, location, createdAt, assessments } = garden;

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
      case GardenTab.Work: {
        const workFetchStatus =
          mergedWorks.length > 0 ? "success" : isFetching ? "pending" : gardenStatus;
        return (
          <GardenWork workFetchStatus={workFetchStatus} actions={actions} works={mergedWorks} />
        );
      }
      case GardenTab.Reports:
        return (
          <GardenAssessments
            asessmentFetchStatus={isFetching ? "pending" : gardenStatus}
            assessments={assessments}
          />
        );
      case GardenTab.Gardeners:
        return <GardenGardeners members={members} garden={garden} />;
    }
  };

  // No custom scroll restoration; StandardTabs resets nearest scroll container

  return (
    <GardenErrorBoundary>
      <div className="h-full min-h-0 w-full flex flex-col relative overflow-hidden">
        {pathname.includes("work") || pathname.includes("assessments") ? null : (
          <>
            {/* Fixed Header (banner + TopNav + title/metadata) */}
            <div className="fixed top-0 left-0 right-0 bg-white z-20">
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
                    works={mergedWorks}
                    garden={garden}
                  />
                </div>
              </div>

              {/* Title and meta below banner */}
              <div className="px-4 md:px-6 mt-3 flex flex-col gap-1.5 pb-3 bg-white">
                <h1 className="text-xl md:text-2xl font-semibold line-clamp-1">{name}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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

              {/* Tabs sticky under header */}
              <div className="sticky top-0 left-0 right-0 w-full bg-white z-10 shadow-sm">
                <StandardTabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as GardenTab)}
                  variant="compact"
                  isLoading={isFetching}
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

            {/* Scrollable content below fixed header (add top padding to match header height) */}
            <div
              className="flex-1 min-h-0 px-4 md:px-6 pb-4 pt-56 overflow-y-auto"
              aria-busy={isFetching}
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
