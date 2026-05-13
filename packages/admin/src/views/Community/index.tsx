import {
  buildCommunityHeaderStats,
  MetaStrip,
  useCommunityWorkspaceController,
  useMediaQuery,
} from "@green-goods/shared";
import { useMemo } from "react";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CommunitySheetDescriptor } from "./components/CommunitySheetDescriptor";
import { CommunityWorkspaceContent } from "./components/CommunityWorkspaceContent";
import { useIntl } from "react-intl";

export default function CommunityView() {
  const { formatMessage } = useIntl();
  const community = useCommunityWorkspaceController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const totalPeople = community.derived.directoryEntries.length;

  const headerStats = useMemo(
    () =>
      buildCommunityHeaderStats({
        hasSelectedGarden: Boolean(community.selectedGarden),
        peopleCount: totalPeople,
        poolCount: community.pools.length,
        vaultNetDeposited: community.vaultNetDeposited,
        formatMessage,
      }),
    [
      community.selectedGarden,
      totalPeople,
      community.pools.length,
      community.vaultNetDeposited,
      formatMessage,
    ]
  );

  return (
    <CanvasRouteFrame
      ref={community.containerRef}
      data-component="CommunityWorkspace"
      data-region="workspace-community"
    >
      <CommunitySheetDescriptor
        isVaultRoute={community.isVaultRoute}
        isStrategiesRoute={community.isStrategiesRoute}
        isSignalPoolRoute={community.isSignalPoolRoute}
        poolType={community.poolType}
        gardenAddress={community.selectedGardenAddress}
      />

      <CanvasRouteHeader
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        description={formatMessage({
          id: "cockpit.community.description",
          defaultMessage: "Treasury, governance, payouts, and the people around the garden.",
        })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        actions={
          isDesktop && community.desktopActions.length > 0 ? (
            <AdminViewActions items={community.desktopActions} />
          ) : undefined
        }
        variant="canvas"
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({
            id: "cockpit.community.viewSwitcher",
            defaultMessage: "Community views",
          })}
          activeId={community.mode}
          onChange={community.handleModeChange}
          tabs={[
            {
              id: "treasury",
              label: formatMessage({
                id: "cockpit.community.treasury",
                defaultMessage: "Treasury",
              }),
              count: community.derived.hasVaults ? 1 : undefined,
            },
            {
              id: "governance",
              label: formatMessage({
                id: "cockpit.community.governance",
                defaultMessage: "Governance",
              }),
              count: community.pools.length || undefined,
            },
            {
              id: "payouts",
              label: formatMessage({
                id: "cockpit.community.payouts",
                defaultMessage: "Payouts",
              }),
              count: community.allocations.length || undefined,
            },
            {
              // Internal id stays "members" (controller, route resolver, and
              // backend hooks all key off it). The user-facing label is "People"
              // per the IA-Community decision in audit §5 — broader community of
              // funders + supporters + contributors, not a garden roster.
              id: "members",
              label: formatMessage({
                id: "cockpit.community.people",
                defaultMessage: "People",
              }),
              count: totalPeople || undefined,
            },
          ]}
        />
      </CanvasRouteHeader>

      <CommunityWorkspaceContent workspace={community} />
    </CanvasRouteFrame>
  );
}
