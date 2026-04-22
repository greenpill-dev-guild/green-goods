import { type Address, Alert, Surface } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import type { AdminWorkspaceSectionTab } from "@/routes/workspaceNavigation";
import { ImpactTab } from "./ImpactTab";
import { OverviewTab } from "./OverviewTab";
import type { useGardenWorkspaceController } from "../useGardenWorkspaceController";

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
    <div className="mt-4 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <Surface elevation="solid-raised" padding="default" className="overflow-hidden">
          {workspace.view === "overview" ? (
            <OverviewTab
              section={workspace.section}
              selectedItem={workspace.selectedItem}
              selectedRange={workspace.range}
              clearSection={workspace.clearSection}
              openSection={workspace.openSection}
              updateQueryState={workspace.updateOverviewQueryState}
              setTab={(tab) =>
                workspace.openSection(
                  tab as AdminWorkspaceSectionTab,
                  tab === "community" ? "treasury" : "queue"
                )
              }
              overviewAlerts={workspace.derived.overviewAlerts}
              gardenHealthLabel={workspace.derived.gardenHealthLabel}
              approvedInRangeCount={workspace.derived.approvedInRangeCount}
              impactVelocityDelta={workspace.derived.impactVelocityDelta}
              medianReviewAgeHours={workspace.derived.medianReviewAgeHours}
              activityFilter={workspace.activityFilter}
              setActivityFilter={workspace.setActivityFilter}
              filteredActivityEvents={workspace.canvasActivityEvents}
              isLoading={workspace.fetching}
              pendingWorkCount={workspace.derived.pendingWorks.length}
              assessmentCount30d={workspace.assessments.length}
              gardenerCount={workspace.garden.gardeners.length}
              treasuryBalance={workspace.treasuryBalance}
            />
          ) : null}

          {workspace.view === "impact" ? (
            <ImpactTab
              garden={{ id: workspace.garden.id, chainId: workspace.garden.chainId }}
              gardenId={workspace.garden.id}
              canManage={workspace.canManage}
              canReview={workspace.canReview}
              section={workspace.section}
              selectedItem={workspace.selectedItem}
              clearSection={workspace.clearSection}
              openSection={workspace.openSection}
              assessments={workspace.assessments}
              fetchingAssessments={workspace.fetchingAssessments}
              assessmentsError={workspace.assessmentsError}
              hypercerts={workspace.hypercerts}
              hypercertsLoading={workspace.fetching}
              domainLabels={workspace.derived.domainLabels}
              approvedInLastThirtyDays={workspace.derived.approvedInLastThirtyDays}
            />
          ) : null}

          {workspace.view === "settings" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <GardenSettingsEditor
                gardenAddress={workspace.garden.id as Address}
                garden={{
                  name: workspace.garden.name,
                  description: workspace.garden.description,
                  location: workspace.garden.location,
                  bannerImage: workspace.garden.bannerImage,
                  openJoining: workspace.garden.openJoining,
                  maxGardeners: workspace.garden.maxGardeners,
                }}
                canManage={workspace.canManage}
                isOwner={workspace.isOwner}
              />

              <div className="space-y-4">
                <Alert variant="info">
                  {formatMessage({
                    id: "cockpit.garden.settingsHint",
                    defaultMessage:
                      "Profile, joining rules, and membership limits now live in the canvas garden workspace.",
                  })}
                </Alert>

                <Surface
                  elevation="ground"
                  padding="compact"
                  className="space-y-2 text-sm text-text-sub"
                >
                  <h3 className="label-md text-text-strong">
                    {formatMessage({
                      id: "cockpit.garden.contextCard",
                      defaultMessage: "Garden context",
                    })}
                  </h3>
                  <p>
                    <span className="font-medium text-text-strong">{workspace.garden.name}</span>
                  </p>
                  {workspace.garden.location ? <p>{workspace.garden.location}</p> : null}
                  {workspace.community ? (
                    <p>
                      {formatMessage({
                        id: "cockpit.garden.communityConnected",
                        defaultMessage: "Community connected",
                      })}
                    </p>
                  ) : null}
                </Surface>
              </div>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
