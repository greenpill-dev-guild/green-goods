import {
  HUB_STAGE_RAIL_ID,
  NativeSelect,
  useHubWorkbenchController,
  useMediaQuery,
} from "@green-goods/shared";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { useIntl } from "react-intl";
import { HubSheetDescriptor, HubStageContent } from "./components";

export default function HubView() {
  const { formatMessage } = useIntl();
  const hub = useHubWorkbenchController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

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
            wrapperClassName="hub-route-content flex flex-col gap-4 sm:gap-5"
            title={formatMessage({ id: "cockpit.hub.title", defaultMessage: "Hub" })}
            description={formatMessage({
              id: "cockpit.hub.description",
              defaultMessage:
                "Review submitted work, run assessments, and certify impact across your gardens.",
            })}
            variant="canvas"
            sticky
            actions={
              isDesktop && hub.desktopActions.length > 0 ? (
                <AdminViewActions items={hub.desktopActions} />
              ) : undefined
            }
            toolbar={
              <AdminSearchToolbar
                search={hub.searchTerm}
                onSearchChange={hub.setSearchTerm}
                placeholder={hub.searchPlaceholder}
              >
                {(hub.stage === "work" || hub.stage === "history") && (
                  <label className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container))] pl-3 pr-2 text-body-md text-[rgb(var(--m3-on-surface-variant))]">
                    <span className="whitespace-nowrap">
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
                      className="h-full min-h-0 rounded-full border-0 bg-transparent py-0 pl-1 pr-8 text-body-md text-text-strong shadow-none"
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
            className="hub-route-content flex flex-col gap-4 sm:gap-5"
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
