import {
  type Address,
  adminRoutes,
  formatTokenAmount,
  parseGardenRange,
  useAdminGardenWorkspaceSelection,
  useCanvasSearchParams,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenStateStore,
  useMediaQuery,
  useSheetWidth,
  useViewActions,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  type AdminWorkspaceSectionTab,
  resolveAdminWorkspaceSectionRoute,
} from "../navigation/workspaceNavigation";
import { buildGardenViewActions, resolveGardenView } from "./garden.utils";

type ActivityFilter = "all" | "work" | "impact" | "community";

function parseActivityFilter(value: string): ActivityFilter {
  return value === "work" || value === "impact" || value === "community" ? value : "all";
}

export function useGardenWorkspaceController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hypercertId, commitmentId: poolCommitmentId } = useParams<{
    hypercertId?: string;
    commitmentId?: string;
  }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection();
  const { containerRef } = useSheetWidth();
  const gardenStateKey = selectedGarden?.id ?? "";
  const selectedGardenAddress = selectedGarden?.id;
  const getGardenWorkspaceState = useGardenStateStore((state) => state.getGardenWorkspaceState);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const lastHydratedGardenStateKeyRef = useRef<string | null>(null);
  const [activityFilter, setActivityFilterState] = useState<ActivityFilter>("all");

  const view = resolveGardenView(location.pathname);
  const settingsOpen = location.pathname.startsWith("/garden/settings");
  // The seeding console is a route-backed dialog over the Pool tab (§6.3).
  const poolSeedOpen = location.pathname.startsWith("/garden/pool/seed");
  const range = parseGardenRange(searchParams.get("range"));
  const section = searchParams.get("section") ?? undefined;
  const selectedItem = searchParams.get("item") ?? undefined;

  useEffect(() => {
    if (lastHydratedGardenStateKeyRef.current === gardenStateKey) return;

    const persistedState = getGardenWorkspaceState(gardenStateKey, "garden");
    setActivityFilterState(parseActivityFilter(persistedState.filter));
    lastHydratedGardenStateKeyRef.current = gardenStateKey;
  }, [gardenStateKey, getGardenWorkspaceState]);

  useEffect(() => {
    if (!selectedGarden) return;

    setGardenWorkspaceState(gardenStateKey, "garden", {
      activeMode: view,
      filter: activityFilter,
      selectedItem: selectedItem ?? hypercertId ?? poolCommitmentId ?? null,
      sheetOpen: Boolean(hypercertId) || Boolean(poolCommitmentId) || settingsOpen || poolSeedOpen,
    });
  }, [
    activityFilter,
    gardenStateKey,
    hypercertId,
    poolCommitmentId,
    poolSeedOpen,
    selectedGarden,
    selectedItem,
    setGardenWorkspaceState,
    settingsOpen,
    view,
  ]);

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
    hypercertsLoading,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewActions = useMemo(
    () =>
      buildGardenViewActions(view, canManage, Boolean(selectedGarden), navigate, {
        gardenAddress: selectedGardenAddress,
      }),
    [canManage, navigate, selectedGarden, selectedGardenAddress, view]
  );
  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
    blocked: Boolean(hypercertId) || Boolean(poolCommitmentId) || settingsOpen || poolSeedOpen,
  });

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
            ? adminRoutes.hubWorkDetail(event.itemId, { gardenId: selectedGardenAddress })
            : adminRoutes.hubWork({ gardenId: selectedGardenAddress }),
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
        href: adminRoutes.communityEndowment({ gardenId: selectedGardenAddress }),
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
      if (nextView === "settings") {
        navigate(adminRoutes.gardenSettings({ gardenId: selectedGardenAddress }));
      } else if (nextView === "pool") {
        navigate(adminRoutes.gardenPool({ gardenId: selectedGardenAddress }));
      } else if (nextView === "impact") {
        navigate(adminRoutes.gardenImpact({ gardenId: selectedGardenAddress, range }));
      } else if (nextView === "activity") {
        navigate(adminRoutes.gardenActivity({ gardenId: selectedGardenAddress, range }));
      } else {
        navigate(adminRoutes.gardenHealth({ gardenId: selectedGardenAddress, range }));
      }
    },
    [navigate, range, selectedGardenAddress]
  );

  const handleSettingsClose = useCallback(
    () => navigate(adminRoutes.gardenHealth({ gardenId: selectedGardenAddress, range })),
    [navigate, range, selectedGardenAddress]
  );

  // Closing the seed console or a commitment inspector lands back on the Pool tab.
  const poolSheetCloseTo = useMemo(
    () => adminRoutes.gardenPool({ gardenId: selectedGardenAddress }),
    [selectedGardenAddress]
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
    desktopActions,
    error,
    fetching,
    fetchingAssessments,
    garden,
    gardenOptions,
    hypercertSheetCloseTo,
    poolCommitmentId,
    poolSeedOpen,
    poolSheetCloseTo,
    handleSelectGarden,
    handleSettingsClose,
    handleTabChange,
    hypercertId,
    hypercerts,
    hypercertsLoading,
    isOwner,
    openSection,
    range,
    roleMembers,
    section,
    selectedGarden,
    selectedItem,
    setActivityFilter,
    settingsOpen,
    treasuryBalance: formatTokenAmount(vaultNetDeposited),
    updateOverviewQueryState,
    view,
    gardenAddress: garden?.id as Address | undefined,
  };
}
