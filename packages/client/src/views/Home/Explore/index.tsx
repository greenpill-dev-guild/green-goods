import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useLoadingWithMinDuration } from "@green-goods/shared/hooks/app/useLoadingWithMinDuration";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import {
  type GardenFiltersState,
  useFilteredGardens,
} from "@green-goods/shared/hooks/garden/useFilteredGardens";
import { useAwaitingJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useAsyncEffect } from "@green-goods/shared/hooks/utils/useAsyncEffect";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { logger } from "@green-goods/shared/modules/app/logger";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Domain, Garden } from "@green-goods/shared/types/domain";
import { RiArrowLeftLine, RiFilterLine } from "@remixicon/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { APP_ROUTES } from "@/config/pwaRouting";
import type { GardenVisitState } from "../Garden";
import { GardenList } from "../GardenList";
import { type ExploreTag, exploreGardens } from "../homeGardens";
import { StickyTopBar } from "../StickyTopBar";

const loadGardensFilterSheet = () => import("../GardenFilters");
const GardensFilterSheet = lazy(() =>
  loadGardensFilterSheet().then(({ GardensFilterSheet }) => ({ default: GardensFilterSheet }))
);

const TAG_IDS: Record<ExploreTag, string> = {
  member: "app.home.explore.tag.member",
  awaiting: "app.home.awaitingReview",
  open: "app.home.explore.tag.open",
};

/**
 * Explore (DL-125, DL-126): every garden the app lists, under Home so the bottom bar stays on
 * Home, with the member's own first and one tag on each card's photo. Its top bar has Back, the
 * title and Filters, which opens the Filter Gardens sheet. A card visits its garden and leaves
 * the active garden alone; the two family test gardens are listed only for their members.
 */
export function Explore() {
  const intl = useIntl();
  const routerNavigate = useNavigate();
  const navigate = useCallback(
    (path: string, state?: GardenVisitState) =>
      routerNavigate(path, { viewTransition: true, state }),
    [routerNavigate]
  );

  const { data: gardens = [], isFetching, isPending, isError, refetch } = useGardens();
  const isOnline = useOnlineStatus();
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress = primaryAddress?.toLowerCase() ?? null;
  const { myGardens } = useActiveGarden();
  const gardenIds = useMemo(() => gardens.map(({ id }) => id), [gardens]);
  const awaitingIds = useAwaitingJoinRequests(gardenIds);

  // Filters live in the UI store so they hold across navigation and relaunch.
  const filters = useUIStore((s) => s.gardenFilters);
  const setFilters = useUIStore((s) => s.setGardenFilters);
  const resetFilters = useUIStore((s) => s.resetGardenFilters);
  const isGardenFilterOpen = useUIStore((s) => s.isGardenFilterOpen);
  const openGardenFilter = useUIStore((s) => s.openGardenFilter);
  const closeGardenFilter = useUIStore((s) => s.closeGardenFilter);
  // The sheet stays mounted until its exit has played.
  const isGardenFilterPresent = useExitPresence(isGardenFilterOpen, getPwaSheetExitMs);
  useEffect(() => closeGardenFilter, [closeGardenFilter]);
  // Filters fetches its sheet's code as Explore mounts and waits for it, disabled and busy, so
  // its first tap opens the sheet (DL-132). A fetch that fails is logged and frees the button:
  // the sheet's lazy import then reports the failure through the route's error frame when
  // Filters opens it.
  const [isFilterReady, setIsFilterReady] = useState(false);
  useAsyncEffect(async ({ isMounted }) => {
    await loadGardensFilterSheet().catch((error: unknown) =>
      logger.warn("Could not preload the Filter Gardens sheet", { source: "Explore", error })
    );
    if (isMounted()) setIsFilterReady(true);
  }, []);

  const isLoadingData = isPending || (isFetching && gardens.length === 0);
  const {
    showSkeleton,
    timedOut,
    reset: resetLoadingState,
  } = useLoadingWithMinDuration(isLoadingData, gardens.length > 0);

  const { filteredGardens, myGardensCount, openGardensCount, isFilterActive, activeFilterCount } =
    useFilteredGardens(gardens, filters, normalizedAddress);
  const { listed, tags } = useMemo(() => {
    const myGardenIds = new Set(myGardens.gardens.map(({ garden }) => garden.id.toLowerCase()));
    const entries = exploreGardens(filteredGardens, myGardenIds, awaitingIds);
    return {
      listed: entries.map(({ garden }) => garden),
      tags: new Map(entries.map(({ garden, tag }) => [garden.id, tag])),
    };
  }, [awaitingIds, filteredGardens, myGardens.gardens]);
  const tagFor = (garden: Garden) => {
    const tag = tags.get(garden.id);
    return tag ? intl.formatMessage({ id: TAG_IDS[tag] }) : undefined;
  };

  const handleRetry = () => {
    resetLoadingState();
    void refetch();
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
    <article className="mb-6">
      <StickyTopBar component="ExploreTopBar" className="gap-2">
        <IconButton
          emphasis="secondary"
          size="compact"
          onClick={() => navigate(APP_ROUTES.home)}
          aria-label={intl.formatMessage({ id: "app.common.back" })}
          icon={<RiArrowLeftLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
        />
        <h1 className="flex min-h-12 min-w-0 flex-1 items-center justify-center truncate type-title-sm text-text-strong">
          {intl.formatMessage({ id: "app.home.explore.title" })}
        </h1>
        <IconButton
          emphasis="secondary"
          size="compact"
          onClick={openGardenFilter}
          disabled={!isFilterReady}
          aria-busy={!isFilterReady}
          // The glyph is green at rest (DL-133); active filters tint the outline and count on the badge.
          className={isFilterActive ? pwaStatusStyles.primary.border : undefined}
          aria-label={intl.formatMessage({ id: "app.home.filters.button" })}
          icon={<RiFilterLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
          badge={isFilterActive ? <CountBadge count={activeFilterCount} ring /> : undefined}
        />
      </StickyTopBar>
      <div className="padded flex flex-col gap-(--gg-list-gap) pt-2">
        <GardenList
          gardens={listed}
          tagFor={tagFor}
          onCardClick={(id) =>
            navigate(`${APP_ROUTES.home}/${id}`, { returnTo: APP_ROUTES.explore })
          }
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
            openGardensCount={openGardensCount}
            isFilterActive={isFilterActive}
          />
        </Suspense>
      ) : null}
    </article>
  );
}
