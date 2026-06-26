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
  resolveAdminWorkspaceSectionRoute,
  type AdminWorkspaceSectionTab,
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
  const [domainEditorOpen, setDomainEditorOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const view = resolveGardenView(location.pathname);
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
  const openDomainEditor = useCallback(() => setDomainEditorOpen(true), []);
  const closeDomainEditor = useCallback(() => setDomainEditorOpen(false), []);
  const openAddMember = useCallback(() => setAddMemberOpen(true), []);
  const closeAddMember = useCallback(() => setAddMemberOpen(false), []);
  const viewActions = useMemo(
    () =>
      buildGardenViewActions(
        view,
        canManage,
        Boolean(selectedGarden),
        navigate,
        {
          gardenAddress: selectedGardenAddress,
        },
        openAddMember
      ),
    [canManage, navigate, openAddMember, selectedGarden, selectedGardenAddress, view]
  );
  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
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
      if (nextView === "settings") {
        navigate(adminRoutes.gardenSettings({ gardenAddress: selectedGardenAddress }));
      } else if (nextView === "activity") {
        // Tier 4: Activity + Members are net-new tabs per audit IA-Garden.
        // First-delivery navigation is path-only; range/garden context is
        // carried in the workspace controller, not the URL.
        navigate("/garden/activity");
      } else if (nextView === "members") {
        navigate("/garden/members");
      } else {
        navigate(adminRoutes.gardenOverview({ gardenAddress: selectedGardenAddress, range }));
      }
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
    addMemberOpen,
    assessments,
    assessmentsError,
    canManage,
    canReview,
    canvasActivityEvents,
    clearSection,
    closeAddMember,
    community,
    containerRef,
    derived,
    desktopActions,
    domainEditorOpen,
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
    hypercertsLoading,
    isOwner,
    closeDomainEditor,
    openAddMember,
    openDomainEditor,
    openSection,
    range,
    roleMembers,
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
