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
  useSheetWidth,
} from "@green-goods/shared";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  resolveAdminWorkspaceSectionRoute,
  type AdminWorkspaceSectionTab,
} from "@/routes/workspaceNavigation";
import { buildGardenFabConfig, resolveGardenView } from "./garden.utils";

export function useGardenWorkspaceController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hypercertId } = useParams<{ hypercertId?: string }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection();
  const { containerRef } = useSheetWidth();
  const [activityFilter, setActivityFilter] = useState<"all" | "work" | "impact" | "community">(
    "all"
  );

  const view = resolveGardenView(location.pathname);
  const range = parseGardenRange(searchParams.get("range"));
  const section = searchParams.get("section") ?? undefined;
  const selectedItem = searchParams.get("item") ?? undefined;

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
      () => buildGardenFabConfig(view, canManage, Boolean(selectedGarden), navigate),
      [canManage, navigate, selectedGarden, view]
    )
  );

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, nextSection: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(resolveAdminWorkspaceSectionRoute({ tab, section: nextSection, itemId }));
    },
    [navigate, selectedGarden]
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
          href: adminRoutes.hubWork({ item: event.itemId }),
        };
      }

      if (event.category === "impact") {
        return {
          ...event,
          href: adminRoutes.gardenImpact({ item: event.itemId }),
        };
      }

      return {
        ...event,
        href: adminRoutes.communityTreasury(),
      };
    });
  }, [derived.filteredActivityEvents, selectedGarden]);

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
          ? adminRoutes.gardenImpact({ range })
          : nextView === "settings"
            ? adminRoutes.gardenSettings()
            : adminRoutes.gardenOverview({ range })
      );
    },
    [navigate, range]
  );

  const handleCloseHypercertSheet = useCallback(() => {
    navigate(
      adminRoutes.gardenImpact({
        range,
        section: section ?? "hypercerts",
      })
    );
  }, [navigate, range, section]);

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
    handleCloseHypercertSheet,
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
