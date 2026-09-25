import type { useGardenWorkspaceController } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { EditGardenDialog } from "./EditGardenDialog";
import { OverviewTab } from "./OverviewTab";
import { ImpactTab } from "./ImpactTab";
import { GardenPoolTab } from "../Pool";

interface GardenWorkspaceContentProps {
  workspace: ReturnType<typeof useGardenWorkspaceController>;
}

export function GardenWorkspaceContent({ workspace }: GardenWorkspaceContentProps) {
  const { formatMessage } = useIntl();
  if (!workspace.selectedGarden) {
    return (
      <CanvasWorkspaceSelectionGate
        workspaceLabel={formatMessage({ id: "cockpit.nav.garden", defaultMessage: "Garden" })}
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
            id: "cockpit.garden.loadFailedDescription",
            defaultMessage: "Try choosing a different garden or refreshing the page.",
          })
        }
      />
    );
  }

  return (
    <div className="mt-4 min-h-0 flex-1 space-y-4">
      {workspace.view === "health" || workspace.view === "activity" ? (
        <OverviewTab
          mode={workspace.view}
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          selectedRange={workspace.range}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          updateQueryState={workspace.updateOverviewQueryState}
          overviewAlerts={workspace.derived.overviewAlerts}
          gardenHealthLabel={workspace.derived.gardenHealthLabel}
          approvedInRangeCount={workspace.derived.approvedInRangeCount}
          impactVelocityDelta={workspace.derived.impactVelocityDelta}
          medianReviewLatencyMs={workspace.derived.reviewQueue.medianReviewLatencyMs}
          activityFilter={workspace.activityFilter}
          setActivityFilter={workspace.setActivityFilter}
          filteredActivityEvents={workspace.canvasActivityEvents}
          isLoading={workspace.fetching}
          pendingWorkCount={workspace.derived.pendingWorks.length}
          assessmentCount30d={workspace.assessments.length}
          gardenerCount={workspace.garden.gardeners.length}
          treasuryBalance={workspace.treasuryBalance}
          karmaIntegration={workspace.karmaIntegration}
        />
      ) : null}

      {workspace.view === "pool" ? (
        <GardenPoolTab
          garden={{ id: workspace.garden.id as Address, name: workspace.garden.name }}
          chainId={workspace.garden.chainId}
          canManage={workspace.canManage}
        />
      ) : null}

      {workspace.view === "impact" ? (
        <ImpactTab
          garden={workspace.garden}
          gardenId={workspace.garden.id}
          canManage={false}
          canReview={workspace.canReview}
          canCertify={workspace.canManage}
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          assessments={workspace.assessments}
          fetchingAssessments={workspace.fetchingAssessments}
          assessmentsError={workspace.assessmentsError}
          hypercerts={workspace.hypercerts}
          hypercertsLoading={workspace.hypercertsLoading}
          hypercertsError={workspace.hypercertsError}
          domainLabels={workspace.derived.domainLabels}
          approvedInLastThirtyDays={workspace.derived.approvedInLastThirtyDays}
        />
      ) : null}

      {/* Edit Garden opens from the workspace action over the Overview behind
          it. Deep-linking to /garden/settings opens it directly; closing
          returns to Health. */}
      <EditGardenDialog
        open={workspace.settingsOpen}
        onClose={workspace.handleSettingsClose}
        garden={workspace.garden}
        canManage={workspace.canManage}
        isOwner={workspace.isOwner}
      />
    </div>
  );
}
