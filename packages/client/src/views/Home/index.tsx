import {
  cn,
  queryKeys,
  toastService,
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
import { Outlet, useLocation } from "react-router-dom";

import { PullToRefresh } from "@/components/Inputs";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { type GardenFiltersState, GardensFilterDrawer } from "./GardenFilters";
import { GardenList } from "./GardenList";
import { WalletDrawer } from "./WalletDrawer";
import { WalletDrawerIcon } from "./WalletDrawer/Icon";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

/** Storage key for welcome prompt - shown once per device */
const WELCOME_SHOWN_KEY = "greengoods_welcome_shown";

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

  // Wallet drawer state
  const [isWalletDrawerOpen, setIsWalletDrawerOpen] = useState(false);

  // UI state from store
  const isGardenFilterOpen = useUIStore((s) => s.isGardenFilterOpen);
  const openGardenFilter = useUIStore((s) => s.openGardenFilter);
  const closeGardenFilter = useUIStore((s) => s.closeGardenFilter);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Auth state for welcome message
  const { isAuthenticated } = useAuthState();
  const hasShownWelcomeRef = useRef(false);
  const { set: scheduleWelcome } = useTimeout();

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

  // Show welcome message once for new users - points them to profile for garden discovery
  useEffect(() => {
    if (!isAuthenticated || hasShownWelcomeRef.current) return;
    if (location.pathname !== "/home") return;

    // Check localStorage - only show once per device
    const hasBeenShown = localStorage.getItem(WELCOME_SHOWN_KEY) === "true";
    if (hasBeenShown) {
      hasShownWelcomeRef.current = true;
      return;
    }

    // Mark as shown BEFORE showing toast (prevents re-triggering)
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    hasShownWelcomeRef.current = true;

    // Small delay to let page render first
    scheduleWelcome(() => {
      toastService.info({
        title: intl.formatMessage({
          id: "app.home.welcome.title",
          defaultMessage: "Welcome to Green Goods!",
        }),
        message: intl.formatMessage({
          id: "app.home.welcome.message",
          defaultMessage: "Visit your Profile to discover and join gardens.",
        }),
        duration: 6000,
        action: {
          label: intl.formatMessage({
            id: "app.home.welcome.action",
            defaultMessage: "Go to Profile",
          }),
          onClick: () => navigate("/profile"),
          dismissOnClick: true,
        },
        suppressLogging: true,
      });
    }, 800);
  }, [intl, isAuthenticated, location.pathname, navigate, scheduleWelcome]);

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
      {location.pathname === "/home" && (
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
