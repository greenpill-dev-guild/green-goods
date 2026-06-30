import {
  cn,
  queryKeys,
  toastService,
  useArrivalState,
  useBrowserNavigation,
  useAuthState,
  useFilteredGardens,
  useGardens,
  useLoadingWithMinDuration,
  useNavigateToTop,
  useOffline,
  usePrimaryAddress,
  useTimeout,
  useUIStore,
} from "@green-goods/shared";
import { RiFilterLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useMatch } from "react-router-dom";

import { PullToRefresh } from "@/components/Inputs";
import { APP_ROUTES } from "@/config/pwa-routing";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { type GardenFiltersState, GardensFilterDrawer } from "./GardenFilters";
import { GardenList } from "./GardenList";
import { WalletDrawer } from "./WalletDrawer";
import { WalletDrawerIcon } from "./WalletDrawer/Icon";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";
import { ARRIVAL_TOASTS, type ArrivalActionKind } from "./arrival-toast";

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

  // State-aware arrival orientation (replaces the old generic welcome toast).
  const { kind: arrivalKind, myGardenIds } = useArrivalState();

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

  // Wallet drawer state
  const [isWalletDrawerOpen, setIsWalletDrawerOpen] = useState(false);

  // UI state from store
  const isGardenFilterOpen = useUIStore((s) => s.isGardenFilterOpen);
  const openGardenFilter = useUIStore((s) => s.openGardenFilter);
  const closeGardenFilter = useUIStore((s) => s.closeGardenFilter);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Auth state for welcome message
  const { isAuthenticated } = useAuthState();
  const hasShownArrivalRef = useRef(false);
  const { set: scheduleArrival } = useTimeout();

  // Ref for scrolling to article on card click
  const articleRef = useRef<HTMLElement>(null);

  // Selected garden from the child Outlet's :id route. useMatch is route-shape
  // aware (won't break if /home/:id is later renamed or nested under another
  // segment) where pathname.split("/")[2] would silently mis-index.
  const gardenIdMatch = useMatch("/home/:id/*");
  const selectedGardenId = gardenIdMatch?.params.id;

  // Reset loading state when navigating back to home
  useEffect(() => {
    if (location.pathname === APP_ROUTES.home) {
      resetLoadingState();
    }
  }, [location.pathname, resetLoadingState]);

  // Close filter drawer when navigating away
  useEffect(() => {
    if (location.pathname !== APP_ROUTES.home) {
      closeGardenFilter();
    }
  }, [location.pathname, closeGardenFilter]);

  // Resolve an arrival action to its concrete client side effect.
  const runArrivalAction = useCallback(
    (action: ArrivalActionKind) => {
      switch (action) {
        case "openWorkDashboardDrafts":
          openWorkDashboard("drafts");
          return;
        case "openWorkDashboardPending":
          openWorkDashboard("pending");
          return;
        case "startWork":
          // One garden → jump straight in; several → narrow the list so they pick.
          if (myGardenIds.length === 1) {
            navigate(`/home/${myGardenIds[0]}`);
          } else {
            setFilters((current) =>
              current.scope === "mine" ? current : { ...current, scope: "mine" }
            );
          }
          return;
        case "openHelp":
          navigate(`${APP_ROUTES.profile}?tab=help`);
          return;
      }
    },
    [myGardenIds, navigate, openWorkDashboard]
  );

  // Show a state-aware arrival toast once per browser session, scoped to the signed-in address.
  // useArrivalState already gates on data confidence, so we fire only when arrivalKind !== "none".
  useEffect(() => {
    if (!isAuthenticated || hasShownArrivalRef.current) return;
    if (location.pathname !== APP_ROUTES.home) return;
    if (!normalizedAddress || arrivalKind === "none") return;

    const shownKey = `greengoods:arrival-shown:${normalizedAddress}`;
    if (sessionStorage.getItem(shownKey) === "true") {
      hasShownArrivalRef.current = true;
      return;
    }

    // Mark shown BEFORE scheduling so re-renders / remounts this session don't re-fire.
    sessionStorage.setItem(shownKey, "true");
    hasShownArrivalRef.current = true;

    const spec = ARRIVAL_TOASTS[arrivalKind];
    // Small delay to let the page render first.
    scheduleArrival(() => {
      toastService[spec.status]({
        title: intl.formatMessage({ id: spec.titleId }),
        message: intl.formatMessage({ id: spec.messageId }),
        duration: 6000,
        action: {
          label: intl.formatMessage({ id: spec.actionLabelId }),
          onClick: () => runArrivalAction(spec.action),
          dismissOnClick: true,
        },
        suppressLogging: true,
      });
    }, 700);
  }, [
    arrivalKind,
    intl,
    isAuthenticated,
    location.pathname,
    normalizedAddress,
    runArrivalAction,
    scheduleArrival,
  ]);

  // Handlers
  const handleRetry = () => {
    resetLoadingState();
    queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    refetch();
  };

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    resetLoadingState();
    queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    await refetch();
  }, [queryClient, refetch, resetLoadingState]);

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
      {location.pathname === APP_ROUTES.home && (
        <PullToRefresh
          onRefresh={handlePullToRefresh}
          isRefreshing={isFetching && !isPending}
          disabled={!isOnline}
          refreshLabel={intl.formatMessage({
            id: "app.home.pullToRefresh",
            defaultMessage: "Pull to refresh gardens",
          })}
        >
          <div className="flex items-center justify-between w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="font-semibold flex-1">{intl.formatMessage({ id: "app.home" })}</h4>
            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={openGardenFilter}
                className={cn(
                  "relative p-1 rounded-lg border transition-[color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] tap-feedback",
                  "active:scale-95",
                  "flex items-center justify-center w-8 h-8 tap-target-lg",
                  "focus:outline-none focus:ring-2",
                  pwaStatusStyles.primary.focus,
                  isFilterActive
                    ? cn(pwaStatusStyles.primary.border, pwaStatusStyles.primary.icon)
                    : cn(pwaStatusStyles.neutral.border, pwaStatusStyles.neutral.icon)
                )}
                aria-label={intl.formatMessage({
                  id: "app.home.filters.button",
                  defaultMessage: "Filters",
                })}
              >
                <RiFilterLine className="h-4 w-4" />
                {isFilterActive && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                      pwaStatusStyles.primary.badge
                    )}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <WalletDrawerIcon onClick={() => setIsWalletDrawerOpen(true)} />
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
        </PullToRefresh>
      )}
      <Outlet />
      <WalletDrawer isOpen={isWalletDrawerOpen} onClose={() => setIsWalletDrawerOpen(false)} />
    </article>
  );
};

export default Home;
