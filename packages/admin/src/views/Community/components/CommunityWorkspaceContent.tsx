import { type Address, type CommunityWorkspace, ErrorBoundary } from "@green-goods/shared";
import { useIntl } from "react-intl";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { CommunityPools } from "./CommunityPools";
import { CommunityCoordinationTab } from "./CommunityCoordinationTab";
import { CommunityEndowmentTab } from "./CommunityEndowmentTab";
import { CommunityMembersTab } from "./CommunityMembersTab";
import { CommunityPayoutsTab } from "./CommunityPayoutsTab";
import { CommunityTabSkeleton } from "./CommunityTabSkeleton";

interface CommunityWorkspaceContentProps {
  workspace: CommunityWorkspace;
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

  const isLoading =
    workspace.mode === "members" || workspace.mode === "coordination"
      ? workspace.communityLoading
      : workspace.mode === "endowment"
        ? workspace.vaultsLoading
        : workspace.allocationsLoading;

  if (isLoading) {
    return (
      <div className="mt-4 min-h-0 flex-1">
        <CommunityTabSkeleton mode={workspace.mode} />
      </div>
    );
  }

  const tab =
    workspace.mode === "members" ? (
      <CommunityMembersTab
        garden={workspace.garden}
        canManage={workspace.canManage}
        closeMembersModal={workspace.closeMembersModal}
        memberSearch={workspace.memberSearch}
        roleMembers={workspace.roleMembers}
        roleSummary={workspace.roleSummary}
        scheduleBackgroundRefetch={workspace.scheduleBackgroundRefetch}
        selectedItem={workspace.selectedItem}
        setMemberSearch={workspace.setMemberSearch}
        visibleDirectory={workspace.visibleDirectory}
      />
    ) : workspace.mode === "coordination" ? (
      <CommunityCoordinationTab
        garden={workspace.garden}
        gardenId={workspace.gardenId}
        canManage={workspace.canManage}
        community={workspace.community}
        pools={workspace.pools}
        createPools={workspace.createPools}
        isCreatingPools={workspace.isCreatingPools}
      />
    ) : workspace.mode === "endowment" ? (
      <CommunityEndowmentTab
        garden={workspace.garden}
        hasVaults={workspace.hasVaults}
        treasurySeverity={workspace.treasurySeverity}
        vaultNetDeposited={workspace.vaultNetDeposited}
      />
    ) : (
      <CommunityPayoutsTab
        garden={workspace.garden}
        allocations={workspace.allocations}
        selectedItem={workspace.selectedItem}
      />
    );

  return (
    <div className="mt-4 min-h-0 flex-1">
      <ErrorBoundary context="GardenDetail.CommunityIA">{tab}</ErrorBoundary>
    </div>
  );
}
