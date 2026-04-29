import { MetaStrip, useCommunityWorkspaceController } from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CommunitySheetDescriptor } from "./components/CommunitySheetDescriptor";
import { CommunityWorkspaceContent } from "./components/CommunityWorkspaceContent";
import { useIntl } from "react-intl";

export default function CommunityView() {
  const { formatMessage } = useIntl();
  const community = useCommunityWorkspaceController();
  const totalMembers = community.derived.directoryEntries.length;

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
        maxWidthClassName="max-w-[1400px]"
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        description={formatMessage({
          id: "cockpit.community.description",
          defaultMessage: "Manage treasury, governance, payouts, campaign jars, and members",
        })}
        variant="canvas"
        metadata={
          community.selectedGarden ? (
            <MetaStrip items={[{ id: "garden", label: community.selectedGarden.name }]} />
          ) : undefined
        }
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
              id: "cookies",
              label: formatMessage({
                id: "cockpit.community.cookies",
                defaultMessage: "Cookies",
              }),
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
      </CanvasRouteHeader>

      <CommunityWorkspaceContent workspace={community} />
    </CanvasRouteFrame>
  );
}
