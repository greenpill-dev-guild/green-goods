import {
  type Address,
  adminRoutes,
  formatTokenAmount,
  parseGardenRange,
  useAdminGardenWorkspaceSelection,
  useCanvasSearchParams,
  useFabConfig,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenStateStore,
  useSheetWidth,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  resolveAdminWorkspaceSectionRoute,
  type AdminWorkspaceSectionTab,
} from "../navigation/workspaceNavigation";
import { buildGardenFabConfig, resolveGardenView } from "./garden.utils";
import {
  bindCanvasScrollPositionPersistence,
  restoreCanvasScrollPosition,
} from "../navigation/workspaceScroll";

type ActivityFilter = "all" | "work" | "impact" | "community";

function parseActivityFilter(value: string): ActivityFilter {
  return value === "work" || value === "impact" || value === "community" ? value : "all";
}

export function useGardenWorkspaceController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hypercertId } = useParams<{ hypercertId?: string }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection();
  const { containerRef } = useSheetWidth();
  const gardenStateKey = selectedGarden?.id ?? "";
  const selectedGardenAddress = selectedGarden?.tokenAddress ?? selectedGarden?.id;
  const getGardenWorkspaceState = useGardenStateStore((state) => state.getGardenWorkspaceState);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const lastHydratedGardenStateKeyRef = useRef<string | null>(null);
  const [activityFilter, setActivityFilterState] = useState<ActivityFilter>("all");

  const view = resolveGardenView(location.pathname);
  const range = parseGardenRange(searchParams.get("range"));
  const section = searchParams.get("section") ?? undefined;
  const selectedItem = searchParams.get("item") ?? undefined;

  useEffect(() => {
    if (lastHydratedGardenStateKeyRef.current === gardenStateKey) return;

    const persistedState = getGardenWorkspaceState(gardenStateKey, "garden");
    setActivityFilterState(parseActivityFilter(persistedState.filter));
    restoreCanvasScrollPosition(persistedState.scrollPosition);
    lastHydratedGardenStateKeyRef.current = gardenStateKey;
  }, [gardenStateKey, getGardenWorkspaceState]);

  useEffect(() => {
    if (!selectedGarden) return;

    setGardenWorkspaceState(gardenStateKey, "garden", {
      activeMode: view,
      filter: activityFilter,
      selectedItem: selectedItem ?? hypercertId ?? null,
      sheetOpen: Boolean(hypercertId),
    });
  }, [
    activityFilter,
    gardenStateKey,
    hypercertId,
    selectedGarden,
    selectedItem,
    setGardenWorkspaceState,
    view,
  ]);

  useEffect(() => {
    if (!selectedGarden) return;

    return bindCanvasScrollPositionPersistence((scrollPosition) => {
      setGardenWorkspaceState(gardenStateKey, "garden", { scrollPosition });
    });
  }, [gardenStateKey, selectedGarden, setGardenWorkspaceState]);

  const {
    garden,
    fetching,
    error,
    canManage,
    canReview,
    isOwner,
    assessments,
    fetchingAssessments,
    assessmentsError,
    community,
    gardenVaults,
    vaultNetDeposited,
    allocations,
    works,
    hypercerts,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  useFabConfig(
    useMemo(
      () =>
        buildGardenFabConfig(view, canManage, Boolean(selectedGarden), navigate, {
          gardenAddress: selectedGardenAddress,
        }),
      [canManage, navigate, selectedGarden, selectedGardenAddress, view]
    )
  );

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, nextSection: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(
        resolveAdminWorkspaceSectionRoute({
          tab,
          section: nextSection,
          itemId,
          gardenAddress: selectedGardenAddress,
        })
      );
    },
    [navigate, selectedGarden, selectedGardenAddress]
  );

  const derived = useGardenDerivedState({
    garden: garden ?? { id: selectedGarden?.id ?? "", domainMask: 0, name: "", chainId: 0 },
    works,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
    selectedRange: range,
    activityFilter,
    memberSearch: "",
    section: undefined,
    formatMessage,
    openSection,
  });

  const canvasActivityEvents = useMemo(() => {
    if (!selectedGarden) return derived.filteredActivityEvents;

    return derived.filteredActivityEvents.map((event) => {
      if (event.category === "work") {
        return {
          ...event,
          href: event.itemId
            ? adminRoutes.hubWorkDetail(event.itemId, { gardenAddress: selectedGardenAddress })
            : adminRoutes.hubWork({ gardenAddress: selectedGardenAddress }),
        };
      }

      if (event.category === "impact") {
        return {
          ...event,
          href: adminRoutes.gardenImpact({
            gardenAddress: selectedGardenAddress,
            item: event.itemId,
          }),
        };
      }

      return {
        ...event,
        href: adminRoutes.communityTreasury({ gardenAddress: selectedGardenAddress }),
      };
    });
  }, [derived.filteredActivityEvents, selectedGarden, selectedGardenAddress]);

  const clearSection = useCallback(
    () => updateSearch({ section: undefined, item: undefined }, false),
    [updateSearch]
  );

  const updateOverviewQueryState = useCallback(
    (
      updates: {
        tab?: AdminWorkspaceSectionTab;
        range?: string;
        section?: string;
        item?: string;
      },
      replace?: boolean
    ) => {
      if (updates.tab) {
        openSection(updates.tab, updates.section ?? "", updates.item);
        return;
      }

      updateSearch(
        {
          range: updates.range,
          section: updates.section,
          item: updates.item,
        },
        replace ?? true
      );
    },
    [openSection, updateSearch]
  );

  const handleTabChange = useCallback(
    (nextView: string) => {
      navigate(
        nextView === "impact"
          ? adminRoutes.gardenImpact({ gardenAddress: selectedGardenAddress, range })
          : nextView === "settings"
            ? adminRoutes.gardenSettings({ gardenAddress: selectedGardenAddress })
            : adminRoutes.gardenOverview({ gardenAddress: selectedGardenAddress, range })
      );
    },
    [navigate, range, selectedGardenAddress]
  );

  const hypercertSheetCloseTo = useMemo(
    () =>
      adminRoutes.gardenImpact({
        gardenAddress: selectedGardenAddress,
        range,
        section: section ?? "hypercerts",
      }),
    [range, section, selectedGardenAddress]
  );

  const setActivityFilter = useCallback(
    (nextActivityFilter: ActivityFilter) => {
      setActivityFilterState(nextActivityFilter);
      setGardenWorkspaceState(gardenStateKey, "garden", { filter: nextActivityFilter });
    },
    [gardenStateKey, setGardenWorkspaceState]
  );

  return {
    activityFilter,
    assessments,
    assessmentsError,
    canManage,
    canReview,
    canvasActivityEvents,
    clearSection,
    community,
    containerRef,
    derived,
    error,
    fetching,
    fetchingAssessments,
    garden,
    gardenOptions,
    hypercertSheetCloseTo,
    handleSelectGarden,
    handleTabChange,
    hypercertId,
    hypercerts,
    isOwner,
    openSection,
    range,
    section,
    selectedGarden,
    selectedItem,
    setActivityFilter,
    treasuryBalance: formatTokenAmount(vaultNetDeposited),
    updateOverviewQueryState,
    view,
    gardenAddress: garden?.id as Address | undefined,
  };
}
