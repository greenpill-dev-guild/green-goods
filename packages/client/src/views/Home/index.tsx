import {
  queryKeys,
  useAuth,
  useAutoJoinRootGarden,
  useBrowserNavigation,
  useFilteredGardens,
  useGardens,
  useLoadingWithMinDuration,
  useNavigateToTop,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared/hooks";
import { useUIStore } from "@green-goods/shared/stores";
import { cn } from "@green-goods/shared/utils";
import { RiFilterLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation } from "react-router-dom";

import { GardenList } from "./GardenList";
import { type GardenFiltersState, GardensFilterDrawer } from "./GardenFilters";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const Home: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const queryClient = useQueryClient();
  const intl = useIntl();

  // Data fetching
  const { data: gardens = [], isFetching, isPending, isError, refetch } = useGardens();

  // Auth & connectivity
  const { isOnline } = useOffline();
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress = primaryAddress?.toLowerCase() ?? null;

  // Filter state
  const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "default" });

  // Use extracted hooks for cleaner logic
  const isLoadingData = isPending || (isFetching && gardens.length === 0);
  const {
    showSkeleton,
    timedOut,
    reset: resetLoadingState,
  } = useLoadingWithMinDuration(isLoadingData, gardens.length > 0);

  const { filteredGardens, myGardensCount, isFilterActive, activeFilterCount } = useFilteredGardens(
    gardens,
    filters,
    normalizedAddress
  );

  // UI state from store
  const { isGardenFilterOpen, openGardenFilter, closeGardenFilter } = useUIStore();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Auto-join root garden prompt for new users
  const { isAuthenticated } = useAuth();
  const { promptToJoin } = useAutoJoinRootGarden();
  const hasPromptedJoinRef = useRef(false);

  // Ref for scrolling to article on card click
  const articleRef = useRef<HTMLElement>(null);

  // Selected garden from URL
  const selectedGardenId = location.pathname.split("/")[2];

  // Reset loading state when navigating back to home
  useEffect(() => {
    if (location.pathname === "/home") {
      resetLoadingState();
    }
  }, [location.pathname, resetLoadingState]);

  // Close filter drawer when navigating away
  useEffect(() => {
    if (location.pathname !== "/home") {
      closeGardenFilter();
    }
  }, [location.pathname, closeGardenFilter]);

  // Prompt new users to join root garden after signup
  // This runs once when user lands on Home after authentication
  useEffect(() => {
    if (isAuthenticated && location.pathname === "/home" && !hasPromptedJoinRef.current) {
      hasPromptedJoinRef.current = true;
      // Small delay to let the page settle after navigation
      const timer = setTimeout(() => promptToJoin(), 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, location.pathname, promptToJoin]);

  // Handlers
  const handleRetry = () => {
    resetLoadingState();
    queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    refetch();
  };

  const handleCardClick = (id: string) => {
    navigate(`/home/${id}`);
    articleRef.current?.scrollIntoView();
  };

  const handleScopeChange = (nextScope: GardenFiltersState["scope"]) => {
    setFilters((current) =>
      current.scope === nextScope ? current : { ...current, scope: nextScope }
    );
  };

  const handleSortChange = (nextSort: GardenFiltersState["sort"]) => {
    setFilters((current) => (current.sort === nextSort ? current : { ...current, sort: nextSort }));
  };

  const handleResetFilters = () => {
    setFilters({ scope: "all", sort: "default" });
  };

  return (
    <article ref={articleRef} className="mb-6">
      {location.pathname === "/home" && (
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
                  isFilterActive
                    ? "border-primary text-primary"
                    : "border-stroke-soft-200 text-text-sub-600"
                )}
                aria-label={intl.formatMessage({
                  id: "app.home.filters.button",
                  defaultMessage: "Filters",
                })}
              >
                <RiFilterLine className="h-4 w-4" />
                {isFilterActive && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <WorkDashboardIcon />
            </div>
          </div>
          <div className="padded flex flex-col gap-4">
            <GardenList
              gardens={filteredGardens}
              selectedGardenId={selectedGardenId}
              onCardClick={handleCardClick}
              showSkeleton={showSkeleton}
              timedOut={timedOut}
              isError={isError}
              isOnline={isOnline}
              onRetry={handleRetry}
              scope={filters.scope}
              isFilterActive={isFilterActive}
              hasUserAddress={Boolean(normalizedAddress)}
            />
          </div>
          <GardensFilterDrawer
            isOpen={isGardenFilterOpen}
            onClose={closeGardenFilter}
            filters={filters}
            onScopeChange={handleScopeChange}
            onSortChange={handleSortChange}
            onReset={handleResetFilters}
            canFilterMine={Boolean(normalizedAddress)}
            myGardensCount={myGardensCount}
            isFilterActive={isFilterActive}
          />
        </>
      )}
      <Outlet />
    </article>
  );
};

export default Home;
