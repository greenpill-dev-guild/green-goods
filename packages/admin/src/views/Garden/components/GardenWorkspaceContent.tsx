import {
  type Address,
  Alert,
  EmptyState,
  Surface,
  type AdminWorkspaceSectionTab,
  type useGardenWorkspaceController,
} from "@green-goods/shared";
import { RiPulseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { GardenDomainModal } from "@/components/Garden/GardenDomainEditor";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { OverviewTab } from "./OverviewTab";
import { GardenDomainSummaryRow } from "./GardenDetailHelpers";
import { GardenMembersPanel } from "./GardenMembersPanel";

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
    <div className="mt-4 space-y-4">
      <GardenDomainSummaryRow
        domainMask={workspace.garden.domainMask}
        canManage={workspace.canManage}
        onEditDomains={workspace.openDomainEditor}
      />
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

      {workspace.view === "activity" ? (
        <EmptyState
          icon={<RiPulseLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.garden.activity.empty.title",
            defaultMessage: "Activity feed coming soon",
          })}
          description={formatMessage({
            id: "cockpit.garden.activity.empty.description",
            defaultMessage:
              "Submitted Work, plot updates, plantings, and milestones will surface here as the gardener-floor of this Garden.",
          })}
        />
      ) : null}

      {workspace.view === "members" ? (
        <GardenMembersPanel
          gardenAddress={workspace.garden.id as Address}
          gardenName={workspace.garden.name}
          gardeners={workspace.garden.gardeners}
          operators={workspace.garden.operators ?? []}
          evaluators={workspace.garden.evaluators ?? []}
          funders={workspace.garden.funders ?? []}
          owners={workspace.garden.owners ?? []}
          roleMembers={workspace.roleMembers}
          canManage={workspace.canManage}
          addMemberOpen={workspace.addMemberOpen}
          onOpenAddMember={workspace.openAddMember}
          onCloseAddMember={workspace.closeAddMember}
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
      {workspace.canManage ? (
        <GardenDomainModal
          isOpen={workspace.domainEditorOpen}
          onClose={workspace.closeDomainEditor}
          gardenAddress={workspace.garden.id as Address}
        />
      ) : null}
    </div>
  );
}
