import { Button, MetaStrip } from "@green-goods/shared";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTabRail } from "@/components/AdminTabRail";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { HubSheetDescriptor, HubStageContent } from "./components";
import { HUB_STAGE_RAIL_ID } from "./hub.utils";
import { useHubWorkbenchController } from "./useHubWorkbenchController";

export default function HubView() {
  const { formatMessage } = useIntl();
  const hub = useHubWorkbenchController();

  return (
    <div className="hub-route-shell">
      <HubSheetDescriptor
        routeSheetContentId={hub.routeSheetContentId}
        routeWorkId={hub.routeWorkId}
        activeWorkDetailId={hub.activeWorkDetailId}
        selectedWork={hub.selectedWork}
        selectedCertification={hub.selectedCertification}
        selectedHistoryEvent={hub.selectedHistoryEvent}
        canManage={hub.canManage}
        onNavigateToBase={hub.navigateToHubBase}
        onClose={hub.handleCloseSheet}
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
          <div className="hub-route-content mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:gap-4">
            <PageHeader
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
                          ? "hub-refresh-button [&>svg]:animate-spin"
                          : "hub-refresh-button"
                      }
                    >
                      <RiRefreshLine className="h-4 w-4" />
                    </Button>
                    {(hub.stage === "work" || hub.stage === "history") &&
                      hub.sortOptions.map((option) => (
                        <AdminFilterChip
                          key={option.value}
                          label={option.label}
                          selected={hub.sortDirection === option.value}
                          onToggle={() => hub.updateSearch({ sort: option.value }, false)}
                        />
                      ))}
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
            </PageHeader>
          </div>

          <div className="hub-route-content mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:gap-4">
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

              <div
                key={hub.stage}
                className="hub-results-pane animate-[hub-fade-in_150ms_ease_both] motion-reduce:animate-none"
              >
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
          </div>
        </div>
      )}
    </div>
  );
}
