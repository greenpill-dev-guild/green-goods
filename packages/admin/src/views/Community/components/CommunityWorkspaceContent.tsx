import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
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
      // Coordination carries the pooling elements too (2026-08-25 AD-5): the
      // governance grid first, then the W12 commitment-pooling surface —
      // exactly the protocol pool and this garden, never another garden's,
      // with its privacy banner — as a full-width section beneath.
      <div className="space-y-6">
        <CommunityCoordinationTab
          garden={workspace.garden}
          gardenId={workspace.gardenId}
          canManage={workspace.canManage}
          community={workspace.community}
          pools={workspace.pools}
          createPools={workspace.createPools}
          isCreatingPools={workspace.isCreatingPools}
        />
        <CommunityPools
          chainId={workspace.garden.chainId}
          garden={{ id: workspace.garden.id as Address, name: workspace.garden.name }}
          canManage={workspace.canManage}
        />
      </div>
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
