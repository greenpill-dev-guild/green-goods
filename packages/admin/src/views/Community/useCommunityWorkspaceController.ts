import {
  adminRoutes,
  toastService,
  useAdminGardenWorkspaceSelection,
  useFabConfig,
  useGardenDerivedState,
  useGardenDetailData,
  useSheetWidth,
} from "@green-goods/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  resolveAdminWorkspaceSectionRoute,
  type AdminWorkspaceSectionTab,
} from "@/routes/workspaceNavigation";
import {
  buildCommunityFabConfig,
  communitySectionForMode,
  resolveCommunityMode,
} from "./community.utils";

export function useCommunityWorkspaceController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { poolType } = useParams<{ poolType?: string }>();
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
  const { containerRef } = useSheetWidth();
  const [memberSearch, setMemberSearch] = useState("");

  const mode = resolveCommunityMode(location.pathname);
  const isVaultRoute = location.pathname.startsWith("/community/treasury/vault");
  const isStrategiesRoute = location.pathname.startsWith("/community/governance/strategies");
  const isSignalPoolRoute = location.pathname.startsWith("/community/governance/signal-pool/");

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

  useFabConfig(
    useMemo(
      () => buildCommunityFabConfig(canManage, Boolean(selectedGarden), navigate),
      [canManage, navigate, selectedGarden]
    )
  );

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, section: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(resolveAdminWorkspaceSectionRoute({ tab, section, itemId }));
    },
    [navigate, selectedGarden]
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
          ? adminRoutes.communityGovernance()
          : nextMode === "payouts"
            ? adminRoutes.communityPayouts()
            : nextMode === "members"
              ? adminRoutes.communityMembers()
              : adminRoutes.communityTreasury()
      ),
    [navigate]
  );

  const clearSection = useCallback(() => navigate(adminRoutes.communityTreasury()), [navigate]);
  const openMembersModal = useCallback(() => navigate(adminRoutes.communityMembers()), [navigate]);
  const createPoolsAsync = useCallback(async () => {
    createPools();
  }, [createPools]);

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
    openMembersModal,
    openSection,
    pools,
    poolType,
    scheduleBackgroundRefetch,
    section,
    selectedGarden,
    setMemberSearch,
    vaultNetDeposited,
    vaultsLoading,
  };
}
