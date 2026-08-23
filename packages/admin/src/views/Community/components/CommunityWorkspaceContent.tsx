import { type Address, type useCommunityWorkspaceController } from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiGroupLine,
  RiMoneyDollarCircleLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { CommunityPools } from "./CommunityPools";
import { CommunityTab } from "./CommunityTab";

interface CommunityWorkspaceContentProps {
  workspace: ReturnType<typeof useCommunityWorkspaceController>;
}

export function CommunityWorkspaceContent({ workspace }: CommunityWorkspaceContentProps) {
  const { formatMessage } = useIntl();

  if (!workspace.selectedGarden) {
    return (
      <CanvasWorkspaceSelectionGate
        workspaceLabel={formatMessage({
          id: "cockpit.nav.community",
          defaultMessage: "Community",
        })}
        gardens={workspace.gardenOptions}
        onSelectGarden={workspace.handleSelectGarden}
      />
    );
  }

  if (workspace.fetching) {
    return <CanvasWorkspaceLoadingState />;
  }

  if (!workspace.garden || workspace.error) {
    return (
      <CanvasRouteErrorState
        message={
          workspace.error?.message ??
          formatMessage({
            id: "cockpit.community.loadFailed",
            defaultMessage: "Unable to load this community workspace.",
          })
        }
      />
    );
  }

  // Pools is its own composition (an inner rail over two pool consoles), not
  // a column in the members/coordination/endowment layout.
  if (workspace.mode === "pools") {
    return (
      <div className="mt-4 min-h-0 flex-1">
        <CommunityPools
          chainId={workspace.garden.chainId}
          garden={{ id: workspace.garden.id as Address, name: workspace.garden.name }}
          canManage={workspace.canManage}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 min-h-0 flex-1">
      <CommunityTab
        mode={workspace.mode}
        garden={{ id: workspace.garden.id, name: workspace.garden.name }}
        gardenId={workspace.gardenId}
        canManage={workspace.canManage}
        section={workspace.section}
        selectedItem={workspace.selectedItem}
        showSectionStateCard={false}
        clearSection={workspace.clearSection}
        closeMembersModal={workspace.closeMembersModal}
        community={workspace.community}
        communityLoading={workspace.communityLoading}
        pools={workspace.pools}
        createPools={workspace.createPools}
        isCreatingPools={workspace.isCreatingPools}
        vaultsLoading={workspace.vaultsLoading}
        hasVaults={workspace.derived.hasVaults}
        vaultNetDeposited={workspace.vaultNetDeposited}
        treasurySeverity={workspace.derived.treasurySeverity}
        allocations={workspace.allocations}
        allocationsLoading={workspace.allocationsLoading}
        roleSummary={workspace.derived.roleSummary}
        roleMembers={workspace.roleMembers}
        visibleDirectory={workspace.visibleDirectory}
        memberSearch={workspace.memberSearch}
        setMemberSearch={workspace.setMemberSearch}
        roleIcons={{
          owner: RiShieldCheckLine,
          steward: RiUserLine,
          evaluator: RiCheckboxCircleLine,
          gardener: RiSeedlingLine,
          funder: RiMoneyDollarCircleLine,
          community: RiGroupLine,
        }}
        scheduleBackgroundRefetch={workspace.scheduleBackgroundRefetch}
      />
    </div>
  );
}
