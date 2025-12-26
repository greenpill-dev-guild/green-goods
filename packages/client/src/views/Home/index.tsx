import {
  useAuth,
  useBrowserNavigation,
  useGardens,
  useNavigateToTop,
  useOffline,
} from "@green-goods/shared/hooks";
import { useUIStore } from "@green-goods/shared/stores";
import type { Garden } from "@green-goods/shared/types";
import { cn, gardenHasMember } from "@green-goods/shared/utils";
import { RiFilterLine } from "@remixicon/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation } from "react-router-dom";
import { GardenCard, GardenCardSkeleton } from "@/components/Cards";

// Minimum time to show skeleton before revealing cached data (prevents flash)
const MIN_SKELETON_MS = 1500;
import {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
  GardensFilterDrawer,
} from "./GardenFilters";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const Home: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const { data: gardensResolved = [], isLoading, isError } = useGardens();
  const intl = useIntl();
  const { isOnline } = useOffline();
  const { smartAccountAddress, walletAddress } = useAuth();
  const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "default" });

  // Minimum skeleton display time to prevent flash of cached content
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isLoading && !minTimeElapsed) {
      timerRef.current = setTimeout(() => setMinTimeElapsed(true), MIN_SKELETON_MS);
    }
    return () => clearTimeout(timerRef.current);
  }, [isLoading, minTimeElapsed]);

  // Reset timer when navigating back to home
  useEffect(() => {
    if (location.pathname === "/home") {
      setMinTimeElapsed(false);
    }
  }, [location.pathname]);

  // Use UIStore for filter drawer state (allows AppBar to react to drawer state)
  const { isGardenFilterOpen, openGardenFilter, closeGardenFilter } = useUIStore();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  const selectedGardenId = useMemo(() => location.pathname.split("/")[2], [location.pathname]);
  const primaryAddress = useMemo(() => {
    const address = smartAccountAddress ?? walletAddress;
    return address ? address.toLowerCase() : null;
  }, [smartAccountAddress, walletAddress]);

  const myGardensCount = useMemo(() => {
    if (!primaryAddress) return 0;
    return gardensResolved.reduce(
      (count, garden) =>
        count + (gardenHasMember(primaryAddress, garden.gardeners, garden.operators) ? 1 : 0),
      0
    );
  }, [gardensResolved, primaryAddress]);

  const { scope, sort } = filters;

  const filteredGardens = useMemo(() => {
    let working = gardensResolved;

    if (scope === "mine") {
      if (!primaryAddress) {
        return [];
      }

      working = working.filter((garden) =>
        gardenHasMember(primaryAddress, garden.gardeners, garden.operators)
      );
    }

    if (sort === "name") {
      return [...working].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );
    }

    if (sort === "recent") {
      return [...working].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    return [...working];
  }, [gardensResolved, scope, sort, primaryAddress]);

  const isScopeFiltered = scope !== "all";
  const isSortFiltered = sort !== "default";
  const isFilterActive = isScopeFiltered || isSortFiltered;
  const activeFilterCount = (isScopeFiltered ? 1 : 0) + (isSortFiltered ? 1 : 0);

  useEffect(() => {
    if (location.pathname !== "/home") {
      closeGardenFilter();
    }
  }, [location.pathname, closeGardenFilter]);

  function handleCardClick(id: string) {
    navigate(`/home/${id}`);
    document.getElementsByTagName("article")[0]?.scrollIntoView();
  }

  const handleScopeChange = (nextScope: GardenFilterScope) => {
    setFilters((current) =>
      current.scope === nextScope ? current : { ...current, scope: nextScope }
    );
  };

  const handleSortChange = (nextSort: GardenSortOrder) => {
    setFilters((current) => (current.sort === nextSort ? current : { ...current, sort: nextSort }));
  };

  const handleResetFilters = () => {
    setFilters({ scope: "all", sort: "default" });
  };

  const renderGardens = () => {
    // Show skeletons until min time elapsed OR if no cached data available
    const hasCachedData = gardensResolved.length > 0;
    const showSkeletons = isLoading && (!hasCachedData || !minTimeElapsed);

    if (showSkeletons) {
      return (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <GardenCardSkeleton key={idx} media="large" height="home" />
          ))}
          {!isOnline && (
            <p className="text-center text-sm text-slate-500 mt-4 px-4">
              {intl.formatMessage({
                id: "app.home.offline.loading",
                defaultMessage: "You're offline. Gardens will appear when you reconnect.",
              })}
            </p>
          )}
        </div>
      );
    }

    if (isError && !hasCachedData && !isOnline) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <p className="text-slate-600">
            {intl.formatMessage({
              id: "app.home.offline.error",
              defaultMessage: "Unable to load gardens while offline.",
            })}
          </p>
        </div>
      );
    }

    if (scope === "mine" && !primaryAddress) {
      return (
        <p className="grid place-items-center text-center text-sm italic text-slate-500">
          {intl.formatMessage({
            id: "app.home.filters.scope.mineDisabled",
            defaultMessage: "Sign in or connect a wallet to filter by your gardens.",
          })}
        </p>
      );
    }

    if (!filteredGardens.length) {
      if (scope === "mine" && primaryAddress) {
        return (
          <p className="grid place-items-center text-center text-sm italic text-slate-500">
            {intl.formatMessage({
              id: "app.home.gardens.mineEmpty",
              defaultMessage: "You don't steward any gardens yet.",
            })}
          </p>
        );
      }

      if (isFilterActive) {
        return (
          <p className="grid place-items-center text-center text-sm italic text-slate-500">
            {intl.formatMessage({
              id: "app.home.filters.empty",
              defaultMessage: "No gardens match your filters.",
            })}
          </p>
        );
      }

      return (
        <p className="grid place-items-center text-sm italic">
          {intl.formatMessage({
            id: "app.home.messages.noGardensFound",
            description: "No gardens found",
          })}
        </p>
      );
    }

    // Show offline/refreshing indicator when showing stale data
    const isRefreshing = isLoading && hasCachedData;

    return (
      <>
        {isRefreshing && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-2">
            {isOnline
              ? intl.formatMessage({ id: "app.home.refreshing", defaultMessage: "Refreshing..." })
              : intl.formatMessage({
                  id: "app.home.offline.cached",
                  defaultMessage: "Showing cached data. You're offline.",
                })}
          </div>
        )}
        {filteredGardens.map((garden: Garden) => (
          <GardenCard
            key={garden.id}
            garden={garden}
            media="large"
            height="home"
            showOperators={true}
            selected={garden.id === selectedGardenId}
            {...garden}
            onClick={() => handleCardClick(garden.id)}
          />
        ))}
      </>
    );
  };

  return (
    <article className={"mb-6"}>
      {location.pathname === "/home" ? (
        <>
          <div className="flex items-center justify-between w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="font-semibold flex-1">{intl.formatMessage({ id: "app.home" })}</h4>
            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={openGardenFilter}
                className={cn(
                  "relative p-1 rounded-lg border transition-all duration-200 tap-feedback",
                  "active:scale-95",
                  "flex items-center justify-center w-8 h-8 tap-target-lg",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
                  isFilterActive ? "border-primary text-primary" : "border-slate-200 text-slate-500"
                )}
                aria-label={intl.formatMessage({
                  id: "app.home.filters.button",
                  defaultMessage: "Filters",
                })}
              >
                <RiFilterLine className="h-4 w-4" />
                {isFilterActive ? (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <WorkDashboardIcon />
            </div>
          </div>
          <div className={"padded flex-1 flex flex-col gap-4 overflow-y-scroll overflow-x-hidden"}>
            {renderGardens()}
          </div>
          <GardensFilterDrawer
            isOpen={isGardenFilterOpen}
            onClose={closeGardenFilter}
            filters={filters}
            onScopeChange={handleScopeChange}
            onSortChange={handleSortChange}
            onReset={handleResetFilters}
            canFilterMine={Boolean(primaryAddress)}
            myGardensCount={myGardensCount}
            isFilterActive={isFilterActive}
          />
        </>
      ) : null}
      <Outlet />
    </article>
  );
};

export default Home;
