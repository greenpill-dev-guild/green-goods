import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";
import { useBrowserNavigation } from "@green-goods/shared/hooks/app/useBrowserNavigation";
import { useLoadingWithMinDuration } from "@green-goods/shared/hooks/app/useLoadingWithMinDuration";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type GardenFiltersState,
  useFilteredGardens,
} from "@green-goods/shared/hooks/garden/useFilteredGardens";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiFilterLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { PullToRefresh } from "@/components/Inputs/PullToRefresh";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { APP_ROUTES } from "@/config/pwaRouting";
import { ARRIVAL_TOASTS, type ArrivalActionKind } from "./arrivalToast";
import { CommitmentsDrawerIcon } from "./CommitmentsDrawer/Icon";
import { GardenList } from "./GardenList";
import { WalletDrawerIcon } from "./WalletDrawer/Icon";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const CommitmentsDrawer = lazy(() =>
  import("./CommitmentsDrawer").then(({ CommitmentsDrawer }) => ({ default: CommitmentsDrawer }))
);
const CommitmentsDrawerLauncher = lazy(() =>
  import("./CommitmentsDrawer/Launcher").then(({ CommitmentsDrawerLauncher }) => ({
    default: CommitmentsDrawerLauncher,
  }))
);
const GardensFilterDrawer = lazy(() =>
  import("./GardenFilters").then(({ GardensFilterDrawer }) => ({ default: GardensFilterDrawer }))
);
const WalletDrawer = lazy(() =>
  import("./WalletDrawer").then(({ WalletDrawer }) => ({ default: WalletDrawer }))
);

function DeferredCommitmentsDrawerLauncher({ onClick }: { onClick: () => void }) {
  const [loadCounts, setLoadCounts] = useState(false);

  useEffect(() => {
    const idleCallback =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(callback, 1_000));
    const handle = idleCallback(() => setLoadCounts(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!loadCounts) return <CommitmentsDrawerIcon onClick={onClick} actCount={0} />;
  return (
    <Suspense fallback={<CommitmentsDrawerIcon onClick={onClick} actCount={0} />}>
      <CommitmentsDrawerLauncher onClick={onClick} />
    </Suspense>
  );
}

const Home: React.FC = () => {
  const routerNavigate = useNavigate();
  const navigate = useCallback(
    (path: string) => routerNavigate(path, { viewTransition: true }),
    [routerNavigate]
  );
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
  const { kind: arrivalKind, myGardenIds, needsReviewCount } = useArrivalState();

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
  const isGardenFilterOpen = useUIStore((s) => s.isGardenFilterOpen);
  const openGardenFilter = useUIStore((s) => s.openGardenFilter);
  const closeGardenFilter = useUIStore((s) => s.closeGardenFilter);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const isWalletDrawerOpen = useUIStore((s) => s.isWalletDrawerOpen);
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const closeWalletDrawer = useUIStore((s) => s.closeWalletDrawer);
  const isCommitmentsDrawerOpen = useUIStore((s) => s.isCommitmentsDrawerOpen);
  const openCommitmentsDrawer = useUIStore((s) => s.openCommitmentsDrawer);
  const closeCommitmentsDrawer = useUIStore((s) => s.closeCommitmentsDrawer);

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

  // Close home drawers when navigating away
  useEffect(() => {
    if (location.pathname !== APP_ROUTES.home) {
      closeGardenFilter();
      closeWalletDrawer();
    }
  }, [location.pathname, closeGardenFilter, closeWalletDrawer]);

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
        case "openWorkDashboardNeedsReview":
          openWorkDashboard("pending", "needsReview");
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
        // `count` backs the review message's plural; other messages ignore unused values.
        message: intl.formatMessage({ id: spec.messageId }, { count: needsReviewCount }),
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
    needsReviewCount,
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
      {location.pathname === APP_ROUTES.home && !isOnline ? (
        <p className="px-4 pt-2 text-center text-xs text-text-soft-400" role="status">
          {intl.formatMessage({
            id: "app.home.pullToRefreshOffline",
            defaultMessage: "Offline. Pull to refresh is paused until you reconnect.",
          })}
        </p>
      ) : null}
      {location.pathname === APP_ROUTES.home && (
        <PullToRefresh
          onRefresh={handlePullToRefresh}
          isRefreshing={isFetching && !isPending}
          disabled={!isOnline}
          refreshLabel={intl.formatMessage({
            id: "app.home.pullToRefresh",
            defaultMessage: "Pull to refresh",
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
              <WalletDrawerIcon onClick={openWalletDrawer} />
              <DeferredCommitmentsDrawerLauncher onClick={openCommitmentsDrawer} />
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
              onBrowseAll={() => handleScopeChange("all")}
            />
          </div>
          {isGardenFilterOpen ? (
            <Suspense fallback={null}>
              <GardensFilterDrawer
                isOpen
                onClose={closeGardenFilter}
                filters={filters}
                onScopeChange={handleScopeChange}
                onSortChange={handleSortChange}
                onReset={handleResetFilters}
                canFilterMine={Boolean(normalizedAddress)}
                myGardensCount={myGardensCount}
                isFilterActive={isFilterActive}
              />
            </Suspense>
          ) : null}
        </PullToRefresh>
      )}
      <Outlet />
      {isWalletDrawerOpen ? (
        <Suspense fallback={null}>
          <WalletDrawer isOpen onClose={closeWalletDrawer} />
        </Suspense>
      ) : null}
      {isCommitmentsDrawerOpen ? (
        <Suspense fallback={null}>
          <CommitmentsDrawer isOpen onClose={closeCommitmentsDrawer} />
        </Suspense>
      ) : null}
    </article>
  );
};

export default Home;
