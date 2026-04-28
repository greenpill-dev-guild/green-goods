import {
  Button,
  HUB_STAGE_RAIL_ID,
  MetaStrip,
  NativeSelect,
  useHubWorkbenchController,
} from "@green-goods/shared";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTabRail } from "@/components/AdminTabRail";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { HubSheetDescriptor, HubStageContent } from "./components";

export default function HubView() {
  const { formatMessage } = useIntl();
  const hub = useHubWorkbenchController();

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
        routeHistoryEventId={hub.routeHistoryEventId}
        activeWorkDetailId={hub.activeWorkDetailId}
        selectedWork={hub.selectedWork}
        selectedCertification={hub.selectedCertification}
        selectedHistoryEvent={hub.selectedHistoryEvent}
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
          className="hub-route-stack"
          role="tabpanel"
          id={`${HUB_STAGE_RAIL_ID}-panel`}
          aria-labelledby={`${HUB_STAGE_RAIL_ID}-tab-${hub.stage}`}
        >
          <CanvasRouteHeader
            maxWidthClassName="max-w-[1400px]"
            wrapperClassName="hub-route-content flex flex-col gap-3 sm:gap-4"
            title={hub.stageTitle}
            description={hub.headerDescription}
            variant="canvas"
            metadata={
              hub.selectedGarden ? (
                <MetaStrip items={[{ id: "garden", label: hub.selectedGarden.name }]} />
              ) : undefined
            }
            toolbar={
              <div className="hub-toolbar-shell">
                <AdminSearchToolbar
                  search={hub.searchTerm}
                  onSearchChange={hub.setSearchTerm}
                  placeholder={hub.searchPlaceholder}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={hub.handleRefresh}
                    title={`Last refreshed: ${hub.refreshAgoText}`}
                    aria-label={formatMessage({
                      id: "app.common.refresh",
                      defaultMessage: "Refresh",
                    })}
                    className={
                      hub.worksFetching
                        ? "hub-refresh-button h-10 min-h-10 w-10 rounded-full p-0 [&>svg]:animate-spin"
                        : "hub-refresh-button h-10 min-h-10 w-10 rounded-full p-0"
                    }
                  >
                    <RiRefreshLine className="h-4 w-4" />
                  </Button>
                  {(hub.stage === "work" || hub.stage === "history") && (
                    <label className="flex h-10 items-center gap-2 rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container))] pl-3 pr-2 text-label-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
                      <span>
                        {formatMessage({
                          id: "app.admin.sortSelect.sortBy",
                          defaultMessage: "Sort by",
                        })}
                      </span>
                      <NativeSelect
                        surface="admin"
                        controlSize="sm"
                        value={hub.sortDirection}
                        onChange={(event) => hub.updateSearch({ sort: event.target.value }, false)}
                        aria-label={formatMessage({
                          id: "app.admin.sortSelect.sortBy",
                          defaultMessage: "Sort by",
                        })}
                        className="h-8 min-h-8 rounded-full border-0 bg-transparent py-0 pl-1 pr-8 shadow-none"
                      >
                        {hub.sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  )}
                </AdminSearchToolbar>
              </div>
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
            maxWidthClassName="max-w-[1400px]"
            className="hub-route-content flex flex-col gap-3 sm:gap-4"
          >
            <section className="hub-results-shell surface-section" aria-label={hub.stageTitle}>
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

              <div key={hub.stage} className="hub-results-pane motion-reduce:animate-none">
                <HubStageContent
                  stage={hub.stage}
                  pendingWorks={hub.pendingWorks}
                  assessmentQueue={hub.assessmentQueue}
                  certificationQueue={hub.certificationQueue}
                  historyEvents={hub.historyEvents}
                  worksLoading={hub.worksLoading}
                  fetchingAssessments={hub.fetchingAssessments}
                  hypercertsLoading={hub.hypercertsLoading}
                  allocationsLoading={hub.allocationsLoading}
                  hasDataError={hub.hasDataError}
                  normalizedSearch={hub.normalizedSearch}
                  debouncedSearch={hub.debouncedSearch}
                  actionsMap={hub.actionsMap}
                  selectedGardenName={hub.selectedGarden?.name}
                  selectedWorkId={hub.selectedWork?.id}
                  selectedCertificationId={hub.selectedCertification?.id}
                  selectedHistoryEventId={hub.selectedHistoryEvent?.id}
                  canManage={hub.canManage}
                  onOpenWorkDetail={hub.handleOpenWorkDetail}
                  onClearSearch={hub.handleClearSearch}
                  onOpenCertification={hub.handleOpenCertification}
                  onOpenHistoryEvent={hub.handleOpenHistoryEvent}
                />
              </div>
            </section>
          </CanvasRouteContent>
        </div>
      )}
    </CanvasRouteFrame>
  );
}
