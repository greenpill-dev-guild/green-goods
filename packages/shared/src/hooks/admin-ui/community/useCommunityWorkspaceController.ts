import {
  adminRoutes,
  toastService,
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
import {
  buildCommunityViewActions,
  communitySectionForMode,
  resolveCommunityMode,
} from "./community.utils";

export function useCommunityWorkspaceController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { poolType } = useParams<{ poolType?: string }>();
  const mode = resolveCommunityMode(location.pathname);
  const hasShownAllGardensToastRef = useRef(false);
  const handleAutoSelectGarden = useCallback(
    (garden: { name: string }) => {
      if (hasShownAllGardensToastRef.current) return;

      hasShownAllGardensToastRef.current = true;
      toastService.info({
        title: formatMessage({
          id: "cockpit.community.allGardensRedirect.title",
          defaultMessage: "Community is per-garden",
        }),
        message: formatMessage(
          {
            id: "cockpit.community.allGardensRedirect.message",
            defaultMessage: "Showing {name}. Use the garden chip to switch.",
          },
          { name: garden.name }
        ),
      });
    },
    [formatMessage]
  );
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection({
    autoSelectFirstGarden: true,
    onAutoSelectGarden: handleAutoSelectGarden,
  });
  const { searchParams } = useCanvasSearchParams();
  const { containerRef } = useSheetWidth();
  const gardenStateKey = selectedGarden?.id ?? "";
  const selectedGardenAddress = selectedGarden?.id;
  const getGardenWorkspaceState = useGardenStateStore((state) => state.getGardenWorkspaceState);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const lastHydratedGardenStateKeyRef = useRef<string | null>(null);
  const [memberSearch, setMemberSearchState] = useState("");

  const isVaultRoute = location.pathname.startsWith("/community/treasury/vault");
  const isStrategiesRoute = location.pathname.startsWith("/community/governance/strategies");
  const isSignalPoolRoute = location.pathname.startsWith("/community/governance/signal-pool/");
  const selectedItem = searchParams.get("item") ?? poolType ?? null;
  const sheetOpen = isVaultRoute || isStrategiesRoute || isSignalPoolRoute;

  useEffect(() => {
    if (lastHydratedGardenStateKeyRef.current === gardenStateKey) return;

    const persistedState = getGardenWorkspaceState(gardenStateKey, "community");
    setMemberSearchState(persistedState.search);
    lastHydratedGardenStateKeyRef.current = gardenStateKey;
  }, [gardenStateKey, getGardenWorkspaceState]);

  useEffect(() => {
    if (!selectedGarden) return;

    setGardenWorkspaceState(gardenStateKey, "community", {
      activeMode: mode,
      search: memberSearch,
      selectedItem,
      sheetOpen,
    });
  }, [
    gardenStateKey,
    memberSearch,
    mode,
    selectedGarden,
    selectedItem,
    setGardenWorkspaceState,
    sheetOpen,
  ]);

  const {
    garden,
    fetching,
    error,
    gardenId,
    canManage,
    isOwner,
    community,
    communityLoading,
    pools,
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    allocations,
    allocationsLoading,
    roleMembers,
    works,
    assessments,
    hypercerts,
    scheduleBackgroundRefetch,
  } = useGardenDetailData(selectedGarden?.id);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewActions = useMemo(
    () =>
      buildCommunityViewActions(mode, canManage, isOwner, Boolean(selectedGarden), navigate, {
        gardenAddress: selectedGardenAddress,
      }),
    [canManage, isOwner, mode, navigate, selectedGarden, selectedGardenAddress]
  );
  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
  });

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, section: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(
        resolveAdminWorkspaceSectionRoute({
          tab,
          section,
          itemId,
          gardenAddress: selectedGardenAddress,
        })
      );
    },
    [navigate, selectedGarden, selectedGardenAddress]
  );

  const section = communitySectionForMode(mode);
  const derived = useGardenDerivedState({
    garden: garden ?? { id: selectedGarden?.id ?? "", domainMask: 0, name: "", chainId: 0 },
    works,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch,
    section,
    formatMessage,
    openSection,
  });

  const handleModeChange = useCallback(
    (nextMode: string) =>
      navigate(
        nextMode === "governance"
          ? adminRoutes.communityGovernance({ gardenAddress: selectedGardenAddress })
          : nextMode === "payouts"
            ? adminRoutes.communityPayouts({ gardenAddress: selectedGardenAddress })
            : nextMode === "members"
              ? adminRoutes.communityMembers({ gardenAddress: selectedGardenAddress })
              : adminRoutes.communityTreasury({ gardenAddress: selectedGardenAddress })
      ),
    [navigate, selectedGardenAddress]
  );

  const clearSection = useCallback(
    () => navigate(adminRoutes.communityTreasury({ gardenAddress: selectedGardenAddress })),
    [navigate, selectedGardenAddress]
  );
  const openMembersModal = useCallback(
    () => navigate(adminRoutes.communityMembers({ gardenAddress: selectedGardenAddress })),
    [navigate, selectedGardenAddress]
  );
  // People is engagement/read-only; management lives on Garden → Members.
  const openGardenMembers = useCallback(
    () => navigate(adminRoutes.gardenMembers({ gardenAddress: selectedGardenAddress })),
    [navigate, selectedGardenAddress]
  );
  const createPoolsAsync = useCallback(async () => {
    createPools();
  }, [createPools]);

  const setMemberSearch = useCallback(
    (nextMemberSearch: string) => {
      setMemberSearchState(nextMemberSearch);
      setGardenWorkspaceState(gardenStateKey, "community", { search: nextMemberSearch });
    },
    [gardenStateKey, setGardenWorkspaceState]
  );

  return {
    allocations,
    allocationsLoading,
    canManage,
    clearSection,
    community,
    communityLoading,
    containerRef,
    createPools: createPoolsAsync,
    derived,
    desktopActions,
    error,
    fetching,
    garden,
    gardenId,
    gardenOptions,
    handleModeChange,
    handleSelectGarden,
    hypercerts,
    isCreatingPools,
    isOwner,
    isSignalPoolRoute,
    isStrategiesRoute,
    isVaultRoute,
    memberSearch,
    mode,
    openGardenMembers,
    openMembersModal,
    openSection,
    pools,
    poolType,
    scheduleBackgroundRefetch,
    section,
    selectedGarden,
    selectedGardenAddress,
    setMemberSearch,
    vaultNetDeposited,
    vaultsLoading,
  };
}
