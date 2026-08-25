import { MetaStrip } from "@green-goods/shared/components/Canvas/MetaStrip";
import {
  buildHubHeaderStats,
  HUB_STAGE_RAIL_ID,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { useHubWorkbenchController } from "@green-goods/shared/hooks/admin-ui/hub/useHubWorkbenchController";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { HubSheetDescriptor, HubStageContent } from "./components";

export default function HubView() {
  const { formatMessage } = useIntl();
  const hub = useHubWorkbenchController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const headerStats = useMemo(() => {
    if (hub.worksLoading) return [];
    return buildHubHeaderStats({
      hasSelectedGarden: Boolean(hub.selectedGarden),
      // Queue aging, not stage depth: the stage tab rail already shows the
      // per-stage counts, so the header surfaces what to triage first. Both
      // counts are unfiltered, so an active search never shifts them. The
      // derived warning count includes critical items, so keep waiting as the
      // exclusive 24-72h bucket.
      overdueCount: hub.pendingCriticalCount,
      waitingCount: Math.max(0, hub.pendingWarningCount - hub.pendingCriticalCount),
      formatMessage,
    });
  }, [
    hub.selectedGarden,
    hub.worksLoading,
    hub.pendingCriticalCount,
    hub.pendingWarningCount,
    formatMessage,
  ]);

  return (
    <CanvasRouteFrame
      className="hub-route-shell"
      data-component="HubWorkspace"
      data-region="workspace-hub"
    >
      <HubSheetDescriptor
        routeSheetContentId={hub.routeSheetContentId}
        routeWorkId={hub.routeWorkId}
        routeCertificationId={hub.routeCertificationId}
        activeWorkDetailId={hub.activeWorkDetailId}
        selectedWork={hub.selectedWork}
        selectedCertification={hub.selectedCertification}
        isResolvingSelection={
          hub.worksLoading ||
          hub.fetchingAssessments ||
          hub.hypercertsLoading ||
          hub.allocationsLoading
        }
        canManage={hub.canManage}
        hubContext={hub.hubContext}
        closeTo={hub.routeSheetCloseTo}
        onNavigateToBase={hub.navigateToHubBase}
        onBeforeClose={hub.handleCloseSheet}
      />
      {!hub.selectedGarden && !hub.routeWorkId && !hub.isSubmitRoute ? (
        <CanvasWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })}
          gardens={hub.gardenOptions}
          onSelectGarden={hub.handleSelectGarden}
        />
      ) : (
        <div
          className="hub-route-stack flex min-h-0 flex-1 flex-col"
          role="tabpanel"
          id={`${HUB_STAGE_RAIL_ID}-panel`}
          aria-labelledby={`${HUB_STAGE_RAIL_ID}-tab-${hub.stage}`}
        >
          <CanvasRouteHeader
            wrapperClassName="hub-route-content flex flex-col gap-4 sm:gap-5"
            title={formatMessage({ id: "cockpit.hub.title", defaultMessage: "Hub" })}
            description={formatMessage({
              id: "cockpit.hub.description",
              defaultMessage:
                "Review submitted work, run assessments, and certify impact across your gardens.",
            })}
            metadata={
              headerStats.length > 0 ? (
                <MetaStrip items={headerStats} density="inline" />
              ) : undefined
            }
            variant="canvas"
            sticky
            actions={
              isDesktop && hub.desktopActions.length > 0 ? (
                // Stable trio: positions frozen across stages, the active
                // stage's creation action renders filled.
                <AdminViewActions items={hub.desktopActions} />
              ) : undefined
            }
            toolbar={
              <AdminSearchToolbar
                search={hub.searchTerm}
                onSearchChange={hub.setSearchTerm}
                placeholder={hub.searchPlaceholder}
              >
                {hub.stage === "work" && (
                  <AdminSortSelect
                    value={hub.sortDirection}
                    onChange={(value) => hub.updateSearch({ sort: value }, false)}
                    options={hub.sortOptions}
                  />
                )}
              </AdminSearchToolbar>
            }
          >
            <AdminTabRail
              idBase={HUB_STAGE_RAIL_ID}
              tabs={hub.stages.map((stage) => ({
                id: stage.id,
                label: formatMessage({ id: stage.labelId, defaultMessage: stage.defaultMessage }),
                icon: stage.icon,
                count: stage.count,
              }))}
              activeId={hub.stage}
              ariaLabel={formatMessage({
                id: "cockpit.hub.tabRail",
                defaultMessage: "Hub pipeline stages",
              })}
              onChange={hub.handleStageChange}
            />
          </CanvasRouteHeader>

          <CanvasRouteContent
            data-region="workspace-hub-content"
            className="hub-route-content flex flex-1 flex-col gap-4 sm:gap-5"
          >
            <section className="hub-results-shell" aria-label={hub.stageTitle}>
              <div aria-live="polite" className="sr-only">
                {hub.debouncedSearch &&
                  formatMessage(
                    {
                      id: "cockpit.hub.resultsCount",
                      defaultMessage:
                        "{count, plural, one {# submission found} other {# submissions found}}",
                    },
                    { count: hub.resultCount }
                  )}
              </div>

              {/* No `key={hub.stage}` here: HubStageContent already switches on
                  the `stage` prop, so a keyed remount only tore down and
                  rebuilt the DOM mid route View-Transition (the tab-change
                  glitch). The route transition in PageTransition owns motion. */}
              <div className="hub-results-pane">
                <HubStageContent
                  stage={hub.stage}
                  pendingWorks={hub.pendingWorks}
                  assessmentQueue={hub.assessmentQueue}
                  certificationQueue={hub.certificationQueue}
                  worksLoading={hub.worksLoading}
                  fetchingAssessments={hub.fetchingAssessments}
                  hypercertsLoading={hub.hypercertsLoading}
                  hasDataError={hub.hasDataError}
                  normalizedSearch={hub.normalizedSearch}
                  debouncedSearch={hub.debouncedSearch}
                  actionsMap={hub.actionsMap}
                  selectedGardenName={hub.selectedGarden?.name}
                  selectedWorkId={hub.selectedWork?.id}
                  selectedCertificationId={hub.selectedCertification?.id}
                  canManage={hub.canManage}
                  toConfirm={hub.toConfirm}
                  chainId={hub.chainId}
                  viewer={hub.viewer}
                  selectedCommitmentId={hub.routeCommitmentId}
                  onOpenCommitment={hub.handleOpenCommitment}
                  onCloseCommitment={hub.handleCloseCommitment}
                  onOpenWorkDetail={hub.handleOpenWorkDetail}
                  onClearSearch={hub.handleClearSearch}
                  onOpenCertification={hub.handleOpenCertification}
                />
              </div>
            </section>
          </CanvasRouteContent>
        </div>
      )}
    </CanvasRouteFrame>
  );
}
