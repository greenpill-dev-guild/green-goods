import {
  Alert,
  BottomSheet,
  CanvasMetaStrip,
  CanvasStageTabRail,
  Surface,
  SideSheet,
  adminRoutes,
  useAdminStore,
  useCanvasPortal,
  useFabConfig,
  useGardenDerivedState,
  useGardenDetailData,
  useEligibleAdminGardens,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiGroupLine,
  RiMoneyDollarCircleLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { CommunityTab } from "@/views/Community/components/CommunityTab";
import GardenSignalPoolView from "@/views/Gardens/Garden/SignalPool";
import GardenStrategiesView from "@/views/Gardens/Garden/Strategies";
import GardenVaultView from "@/views/Gardens/Garden/Vault";

type CommunityWorkspaceMode = "treasury" | "governance" | "payouts" | "members";

function resolveCommunityMode(pathname: string): CommunityWorkspaceMode {
  if (pathname.startsWith("/community/governance")) return "governance";
  if (pathname.startsWith("/community/payouts")) return "payouts";
  if (pathname.startsWith("/community/members")) return "members";
  return "treasury";
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export default function CommunityView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { poolType } = useParams<{ poolType?: string }>();
  const { portalTarget } = useCanvasPortal();
  const { eligibleGardens } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const [memberSearch, setMemberSearch] = useState("");

  const mode = resolveCommunityMode(location.pathname);
  const desktopSheetWidth =
    typeof window === "undefined" ? 560 : Math.min(Math.max(440, window.innerWidth * 0.38), 660);
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

  // FAB: Community management actions (operators only)
  const communityFabConfig = useMemo(() => {
    if (!selectedGarden || !canManage) return null;
    return {
      icon: RiAddLine,
      label: "Community Actions",
      actions: [
        {
          id: "add-member",
          icon: RiUserLine,
          label: "Add Member",
          labelId: "cockpit.community.fab.addMember",
        },
        {
          id: "manage-vault",
          icon: RiMoneyDollarCircleLine,
          label: "Manage Vault",
          labelId: "cockpit.community.fab.manageVault",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "add-member") navigate(adminRoutes.communityMembers());
        else if (actionId === "manage-vault") navigate(adminRoutes.communityTreasuryVault());
      },
    };
  }, [selectedGarden, canManage, navigate]);
  useFabConfig(communityFabConfig);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;

      if (tab === "community") {
        navigate(
          section === "members"
            ? adminRoutes.communityMembers({ item: itemId })
            : section === "cookie-jars" || section === "payouts"
              ? adminRoutes.communityPayouts({ item: itemId })
              : section === "pools" || section === "governance"
                ? adminRoutes.communityGovernance({ item: itemId })
                : adminRoutes.communityTreasury({ item: itemId })
        );
        return;
      }

      if (tab === "work") {
        navigate(adminRoutes.hubWork({ item: itemId }));
        return;
      }

      navigate(
        tab === "impact"
          ? adminRoutes.gardenImpact({ item: itemId })
          : adminRoutes.gardenOverview({ item: itemId })
      );
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
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch,
    section:
      mode === "governance" ? "governance" : mode === "payouts" ? "cookie-jars" : mode,
    formatMessage,
    openSection,
  });

  const totalMembers = derived.directoryEntries.length;
  const communitySheet = useMemo(() => {
    if (isVaultRoute) {
      return {
        title: formatMessage({ id: "app.treasury.title" }),
        content: <GardenVaultView layout="sheet" />,
        onClose: () => navigate(adminRoutes.communityTreasury()),
      };
    }

    if (isStrategiesRoute) {
      return {
        title: formatMessage({ id: "app.conviction.title" }),
        content: <GardenStrategiesView layout="sheet" />,
        onClose: () => navigate(adminRoutes.communityGovernance()),
      };
    }

    if (isSignalPoolRoute) {
      return {
        title: formatMessage({
          id:
            poolType === "action"
              ? "app.signal.actionPool.title"
              : "app.signal.hypercertPool.title",
        }),
        content: <GardenSignalPoolView layout="sheet" />,
        onClose: () => navigate(adminRoutes.communityGovernance()),
      };
    }

    return null;
  }, [
    formatMessage,
    isSignalPoolRoute,
    isStrategiesRoute,
    isVaultRoute,
    navigate,
    poolType,
  ]);

  return (
    <div className="pb-6">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6">
        <PageHeader
          title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
          description={formatMessage({
            id: "cockpit.community.description",
            defaultMessage: "Manage treasury, governance, payouts, and members",
          })}
          variant="canvas"
          metadata={
            selectedGarden ? (
              <CanvasMetaStrip items={[{ id: "garden", label: selectedGarden.name }]} />
            ) : undefined
          }
          sticky
        >
          <CanvasStageTabRail
            ariaLabel={formatMessage({
              id: "cockpit.community.viewSwitcher",
              defaultMessage: "Community views",
            })}
            activeId={mode}
            onChange={(nextMode) =>
              navigate(
                nextMode === "governance"
                  ? adminRoutes.communityGovernance()
                  : nextMode === "payouts"
                    ? adminRoutes.communityPayouts()
                    : nextMode === "members"
                      ? adminRoutes.communityMembers()
                      : adminRoutes.communityTreasury()
              )
            }
            tabs={[
              {
                id: "treasury",
                label: formatMessage({
                  id: "cockpit.community.treasury",
                  defaultMessage: "Treasury",
                }),
                count: derived.hasVaults ? 1 : undefined,
              },
              {
                id: "governance",
                label: formatMessage({
                  id: "cockpit.community.governance",
                  defaultMessage: "Governance",
                }),
                count: pools.length || undefined,
              },
              {
                id: "payouts",
                label: formatMessage({
                  id: "cockpit.community.payouts",
                  defaultMessage: "Payouts",
                }),
                count: allocations.length || undefined,
              },
              {
                id: "members",
                label: formatMessage({
                  id: "cockpit.community.members",
                  defaultMessage: "Members",
                }),
                count: totalMembers || undefined,
              },
            ]}
          />
        </PageHeader>
      </div>

      {!selectedGarden ? (
        <CanvasWorkspaceSelectionState
          workspaceLabel={formatMessage({
            id: "cockpit.nav.community",
            defaultMessage: "Community",
          })}
          gardens={eligibleGardens.map((gardenItem) => ({
            id: gardenItem.id,
            name: gardenItem.name,
            location: gardenItem.location,
          }))}
          onSelectGarden={(gardenItem) => {
            const fullGarden = eligibleGardens.find((entry) => entry.id === gardenItem.id);
            setSelectedGarden(fullGarden ?? null);
          }}
        />
      ) : fetching ? (
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-live="polite">
              <div className="h-40 rounded-lg skeleton-shimmer" />
              <div className="h-40 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.08s" }} />
              <div
                className="h-72 rounded-lg skeleton-shimmer lg:col-span-2"
                style={{ animationDelay: "0.16s" }}
              />
            </div>
          </div>
        </div>
      ) : !garden || error ? (
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Alert variant="error">
              {error?.message ??
                formatMessage({
                  id: "cockpit.community.loadFailed",
                  defaultMessage: "Unable to load this community workspace.",
                })}
            </Alert>
          </div>
        </div>
      ) : (
        <div className="mt-4 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Surface elevation="raised" padding="default" className="overflow-hidden">
              <CommunityTab
                garden={{ id: garden.id, name: garden.name }}
                gardenId={gardenId}
                canManage={canManage}
                isOwner={isOwner}
                section={
                  mode === "governance" ? "governance" : mode === "payouts" ? "cookie-jars" : mode
                }
                showSectionStateCard={false}
                clearSection={() => navigate(adminRoutes.communityTreasury())}
                openSection={openSection}
                community={community}
                communityLoading={communityLoading}
                pools={pools}
                createPools={async () => {
                  createPools();
                }}
                isCreatingPools={isCreatingPools}
                vaultsLoading={vaultsLoading}
                hasVaults={derived.hasVaults}
                vaultNetDeposited={vaultNetDeposited}
                treasurySeverity={derived.treasurySeverity}
                allocations={allocations}
                allocationsLoading={allocationsLoading}
                roleSummary={derived.roleSummary}
                roleIcons={{
                  owner: RiShieldCheckLine,
                  operator: RiUserLine,
                  evaluator: RiCheckboxCircleLine,
                  gardener: RiSeedlingLine,
                  funder: RiMoneyDollarCircleLine,
                  community: RiGroupLine,
                }}
                filteredDirectory={derived.filteredDirectory}
                visibleDirectory={
                  mode === "members" ? derived.filteredDirectory : derived.visibleDirectory
                }
                memberSearch={memberSearch}
                setMemberSearch={setMemberSearch}
                openMembersModal={() => {
                  navigate(adminRoutes.communityMembers());
                }}
                scheduleBackgroundRefetch={scheduleBackgroundRefetch}
              />
            </Surface>
          </div>
        </div>
      )}

      {communitySheet ? (
        isDesktop ? (
          <SideSheet
            open
            onClose={communitySheet.onClose}
            title={communitySheet.title}
            width={desktopSheetWidth}
            side="left"
            container={portalTarget}
          >
            {communitySheet.content}
          </SideSheet>
        ) : (
          <BottomSheet
            open
            onClose={communitySheet.onClose}
            title={communitySheet.title}
            maxHeight={92}
          >
            {communitySheet.content}
          </BottomSheet>
        )
      ) : null}
    </div>
  );
}
