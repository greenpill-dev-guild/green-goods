import { IconButton } from "@green-goods/shared/components/IconButton";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";
import { useBrowserNavigation } from "@green-goods/shared/hooks/app/useBrowserNavigation";
import { useLoadingWithMinDuration } from "@green-goods/shared/hooks/app/useLoadingWithMinDuration";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type GardenFiltersState,
  useFilteredGardens,
} from "@green-goods/shared/hooks/garden/useFilteredGardens";
import type { Domain } from "@green-goods/shared/types/domain";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiFilterLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ComponentType,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { APP_ROUTES } from "@/config/pwaRouting";
import {
  ARRIVAL_TOASTS,
  type ArrivalActionKind,
  hasArrivalPassed,
  markArrivalPassed,
} from "./arrivalToast";
import { CommitmentsSheetIcon } from "./CommitmentsSheet/Icon";
import { GardenList } from "./GardenList";
import { WalletSheetIcon } from "./WalletSheet/Icon";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const CommitmentsSheet = lazy(() =>
  import("./CommitmentsSheet").then(({ CommitmentsSheet }) => ({ default: CommitmentsSheet }))
);
const CommitmentsSheetLauncher = lazy(
  (): Promise<{ default: ComponentType<{ onClick: () => void }> }> =>
    import("./CommitmentsSheet/Launcher")
      .then(({ CommitmentsSheetLauncher }) => ({
        default: CommitmentsSheetLauncher,
      }))
      // Ambient adjunct: if the launcher chunk cannot load (offline dev serving),
      // hide it rather than failing the whole Home route.
      .catch(() => ({ default: () => null }))
);
const GardensFilterSheet = lazy(() =>
  import("./GardenFilters").then(({ GardensFilterSheet }) => ({ default: GardensFilterSheet }))
);
const WalletSheet = lazy(() =>
  import("./WalletSheet").then(({ WalletSheet }) => ({ default: WalletSheet }))
);

function DeferredCommitmentsSheetLauncher({ onClick }: { onClick: () => void }) {
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

  if (!loadCounts) return <CommitmentsSheetIcon onClick={onClick} actCount={0} />;
  return (
    <Suspense fallback={<CommitmentsSheetIcon onClick={onClick} actCount={0} />}>
      <CommitmentsSheetLauncher onClick={onClick} />
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
  const isOnline = useOnlineStatus();
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress = primaryAddress?.toLowerCase() ?? null;

  // State-aware arrival orientation (replaces the old generic welcome toast).
  const { kind: arrivalKind, myGardenIds, needsReviewCount } = useArrivalState();

  // Filters live in the UI store so they hold across navigation and relaunch.
  const filters = useUIStore((s) => s.gardenFilters);
  const setFilters = useUIStore((s) => s.setGardenFilters);
  const resetFilters = useUIStore((s) => s.resetGardenFilters);

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
  const isWalletSheetOpen = useUIStore((s) => s.isWalletSheetOpen);
  const openWalletSheet = useUIStore((s) => s.openWalletSheet);
  const closeWalletSheet = useUIStore((s) => s.closeWalletSheet);
  const isCommitmentsSheetOpen = useUIStore((s) => s.isCommitmentsSheetOpen);
  const openCommitmentsSheet = useUIStore((s) => s.openCommitmentsSheet);
  const closeCommitmentsSheet = useUIStore((s) => s.closeCommitmentsSheet);

  // Each sheet stays mounted until its exit has played; unmounting it on close
  // removed it before the slide-out could run.
  const isGardenFilterPresent = useExitPresence(isGardenFilterOpen, getPwaSheetExitMs);
  const isWalletSheetPresent = useExitPresence(isWalletSheetOpen, getPwaSheetExitMs);
  const isCommitmentsSheetPresent = useExitPresence(isCommitmentsSheetOpen, getPwaSheetExitMs);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Auth state for welcome message
  const { isAuthenticated } = useAuthState();
  const hasShownArrivalRef = useRef(false);
  const { set: scheduleArrival, clear: cancelArrival } = useTimeout();

  // Ref for scrolling to article on card click
  const articleRef = useRef<HTMLElement>(null);

  // Selected garden from the child Outlet's :id route. useMatch is route-shape
  // aware (won't break if /home/:id is later renamed or nested under another
  // segment) where pathname.split("/")[2] would silently mis-index.
  const gardenIdMatch = useMatch("/home/:id/*");
  const selectedGardenId = gardenIdMatch?.params.id;

  // Reset loading state when navigating back to home
  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") === APP_ROUTES.home) {
      resetLoadingState();
    }
  }, [location.pathname, resetLoadingState]);

  // Close home drawers when navigating away
  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") !== APP_ROUTES.home) {
      closeGardenFilter();
      closeWalletSheet();
    }
  }, [location.pathname, closeGardenFilter, closeWalletSheet]);

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
    [myGardenIds, navigate, openWorkDashboard, setFilters]
  );

  // A garden opens as a child route, so Home stays mounted and a toast still waiting on its
  // delay would land on that screen. Leaving Home cancels it; the arrival stays passed.
  useLayoutEffect(() => {
    if (location.pathname.replace(/\/$/, "") !== APP_ROUTES.home) cancelArrival();
  }, [cancelArrival, location.pathname]);

  // Show a state-aware arrival toast once per browser session, scoped to the signed-in address,
  // and only while the session is still on the Home it opened on: AppShell marks the arrival
  // passed as soon as the session is on any other screen.
  // useArrivalState already gates on data confidence, so we fire only when arrivalKind !== "none".
  useEffect(() => {
    if (!isAuthenticated || hasShownArrivalRef.current) return;
    if (location.pathname.replace(/\/$/, "") !== APP_ROUTES.home) return;
    if (!normalizedAddress || arrivalKind === "none") return;

    if (hasArrivalPassed(normalizedAddress)) {
      hasShownArrivalRef.current = true;
      return;
    }

    // Mark it passed BEFORE scheduling so re-renders / remounts this session don't re-fire.
    markArrivalPassed(normalizedAddress);
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

  const handleDomainsChange = (domains: Domain[]) => {
    setFilters((current) => ({ ...current, domains: domains.length > 0 ? domains : undefined }));
  };

  return (
    <article ref={articleRef} className="mb-6">
      {location.pathname.replace(/\/$/, "") === APP_ROUTES.home && (
        <>
          <div className="flex items-center justify-between w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="flex-1 text-[1.125rem] font-semibold">
              {intl.formatMessage({ id: "app.home" })}
            </h4>
            <div className="ml-4 flex items-center gap-2">
              <IconButton
                emphasis="secondary"
                size="compact"
                onClick={openGardenFilter}
                // Active filters tint the outline and icon, and count on the badge.
                className={
                  isFilterActive
                    ? cn(pwaStatusStyles.primary.border, pwaStatusStyles.primary.icon)
                    : undefined
                }
                aria-label={intl.formatMessage({
                  id: "app.home.filters.button",
                  defaultMessage: "Filters",
                })}
                icon={<RiFilterLine aria-hidden="true" />}
                badge={
                  isFilterActive ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                        pwaStatusStyles.primary.badge
                      )}
                    >
                      {activeFilterCount}
                    </span>
                  ) : undefined
                }
              />
              <WalletSheetIcon onClick={openWalletSheet} />
              <DeferredCommitmentsSheetLauncher onClick={openCommitmentsSheet} />
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
          {isGardenFilterPresent ? (
            <Suspense fallback={null}>
              <GardensFilterSheet
                isOpen={isGardenFilterOpen}
                onClose={closeGardenFilter}
                filters={filters}
                onScopeChange={handleScopeChange}
                onSortChange={handleSortChange}
                onDomainsChange={handleDomainsChange}
                onReset={resetFilters}
                canFilterMine={Boolean(normalizedAddress)}
                myGardensCount={myGardensCount}
                isFilterActive={isFilterActive}
              />
            </Suspense>
          ) : null}
        </>
      )}
      <Outlet />
      {isWalletSheetPresent ? (
        <Suspense fallback={null}>
          <WalletSheet isOpen={isWalletSheetOpen} onClose={closeWalletSheet} />
        </Suspense>
      ) : null}
      {isCommitmentsSheetPresent ? (
        <Suspense fallback={null}>
          <CommitmentsSheet isOpen={isCommitmentsSheetOpen} onClose={closeCommitmentsSheet} />
        </Suspense>
      ) : null}
    </article>
  );
};

export default Home;
