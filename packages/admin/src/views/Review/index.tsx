import { MetaStrip } from "@green-goods/shared/components/Canvas/MetaStrip";
import {
  buildReviewHeaderStats,
  REVIEW_STAGE_RAIL_ID,
} from "@green-goods/shared/hooks/admin-ui/review/review.utils";
import { useReviewWorkbenchController } from "@green-goods/shared/hooks/admin-ui/review/useReviewWorkbenchController";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { AdminFilterChip } from "@/components/AdminFilterChip";
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
import { ReviewFlowDialogs, ReviewSheetDescriptor, ReviewStageContent } from "./components";

export default function ReviewView() {
  const { formatMessage } = useIntl();
  const review = useReviewWorkbenchController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const headerStats = useMemo(() => {
    if (review.worksLoading) return [];
    return buildReviewHeaderStats({
      hasSelectedGarden: Boolean(review.selectedGarden),
      // Queue aging, not stage depth: the stage tab rail already shows the
      // per-stage counts. The count is unfiltered, so a search never shifts it.
      waitingOverWeekCount: review.waitingOverWeekCount,
      formatMessage,
    });
  }, [review.selectedGarden, review.worksLoading, review.waitingOverWeekCount, formatMessage]);

  return (
    <CanvasRouteFrame
      className="review-route-shell"
      data-component="ReviewWorkspace"
      data-region="workspace-review"
    >
      <ReviewSheetDescriptor
        routeSheetContentId={review.routeSheetContentId}
        routeWorkId={review.routeWorkId}
        routeCertificationId={review.routeCertificationId}
        activeWorkDetailId={review.activeWorkDetailId}
        selectedWork={review.selectedWork}
        selectedCertification={review.selectedCertification}
        isResolvingSelection={
          review.worksLoading ||
          review.fetchingAssessments ||
          review.hypercertsLoading ||
          review.allocationsLoading
        }
        canManage={review.canManage}
        chainId={review.chainId}
        reviewContext={review.reviewContext}
        closeTo={review.routeSheetCloseTo}
        onNavigateToBase={review.navigateToReviewBase}
        onBeforeClose={review.handleCloseSheet}
      />
      <ReviewFlowDialogs item={review.routeItem} />
      {!review.selectedGarden && !review.routeWorkId && !review.isSubmitRoute ? (
        <CanvasWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "hub.nav.review", defaultMessage: "Review" })}
          gardens={review.gardenOptions}
          onSelectGarden={review.handleSelectGarden}
        />
      ) : (
        <div
          className="review-route-stack flex min-h-0 flex-1 flex-col"
          role="tabpanel"
          id={`${REVIEW_STAGE_RAIL_ID}-panel`}
          aria-labelledby={`${REVIEW_STAGE_RAIL_ID}-tab-${review.stage}`}
        >
          <CanvasRouteHeader
            wrapperClassName="review-route-content flex flex-col gap-4 sm:gap-5"
            title={formatMessage({ id: "hub.review.title", defaultMessage: "Review" })}
            description={formatMessage({
              id: "hub.review.description",
              defaultMessage: "Review and triage pending submissions.",
            })}
            metadata={
              headerStats.length > 0 ? (
                <MetaStrip items={headerStats} density="inline" />
              ) : undefined
            }
            variant="canvas"
            sticky
            actions={
              isDesktop && review.desktopActions.length > 0 ? (
                // Stable trio: positions frozen across stages, the active
                // stage's creation action renders filled.
                <AdminViewActions items={review.desktopActions} />
              ) : undefined
            }
            toolbar={
              <AdminSearchToolbar
                search={review.searchTerm}
                onSearchChange={review.setSearchTerm}
                placeholder={review.searchPlaceholder}
              >
                {review.stage === "work" && (
                  <>
                    {/* Pending and Approved are scopes of one list, not tabs of
                        their own (DL-082). */}
                    <div
                      className="flex flex-wrap items-center gap-1.5"
                      role="group"
                      aria-label={formatMessage({
                        id: "hub.review.work.scope",
                        defaultMessage: "Work status",
                      })}
                    >
                      <AdminFilterChip
                        label={formatMessage({
                          id: "app.admin.work.filter.pending",
                          defaultMessage: "Pending",
                        })}
                        selected={review.workScope === "pending"}
                        onToggle={() => review.handleWorkScopeChange("pending")}
                      />
                      <AdminFilterChip
                        label={formatMessage({
                          id: "app.admin.work.filter.approved",
                          defaultMessage: "Approved",
                        })}
                        selected={review.workScope === "approved"}
                        onToggle={() => review.handleWorkScopeChange("approved")}
                      />
                    </div>
                    <AdminSortSelect
                      value={review.sortDirection}
                      onChange={(value) => review.updateSearch({ sort: value }, false)}
                      options={review.sortOptions}
                    />
                  </>
                )}
              </AdminSearchToolbar>
            }
          >
            <AdminTabRail
              idBase={REVIEW_STAGE_RAIL_ID}
              tabs={review.stages.map((stage) => ({
                id: stage.id,
                label: formatMessage({ id: stage.labelId, defaultMessage: stage.defaultMessage }),
                icon: stage.icon,
                count: stage.count,
              }))}
              activeId={review.stage}
              ariaLabel={formatMessage({
                id: "hub.review.tabRail",
                defaultMessage: "Review pipeline stages",
              })}
              onChange={review.handleStageChange}
            />
          </CanvasRouteHeader>

          <CanvasRouteContent
            data-region="workspace-review-content"
            className="review-route-content flex flex-1 flex-col gap-4 sm:gap-5"
          >
            <section className="review-results-shell" aria-label={review.stageTitle}>
              <div aria-live="polite" className="sr-only">
                {review.debouncedSearch &&
                  formatMessage(
                    {
                      id: "hub.review.resultsCount",
                      defaultMessage:
                        "{count, plural, one {# result found} other {# results found}}",
                    },
                    { count: review.resultCount }
                  )}
              </div>

              {/* No `key={review.stage}` here: ReviewStageContent already switches on
                  the `stage` prop, so a keyed remount only tore down and
                  rebuilt the DOM mid route View-Transition (the tab-change
                  glitch). The route transition in PageTransition owns motion. */}
              <div className="review-results-pane">
                <ReviewStageContent
                  stage={review.stage}
                  works={review.scopedWorks}
                  workScope={review.workScope}
                  assessments={review.assessmentList}
                  hypercerts={review.hypercertList}
                  // Oldest first lists nothing until the whole history is read.
                  worksLoading={review.worksLoading || review.readsWorkHistory}
                  fetchingAssessments={review.fetchingAssessments}
                  hypercertsLoading={review.hypercertsLoading}
                  hasDataError={review.hasDataError}
                  normalizedSearch={review.normalizedSearch}
                  debouncedSearch={review.debouncedSearch}
                  actionsMap={review.actionsMap}
                  selectedGardenName={review.selectedGarden?.name}
                  selectedWorkId={review.selectedWork?.id}
                  selectedCertificationId={review.selectedCertification?.id}
                  createAssessmentHref={
                    review.canReview
                      ? adminRoutes.reviewAssessCreate(review.reviewContext)
                      : undefined
                  }
                  createHypercertHref={
                    review.canManage
                      ? adminRoutes.reviewCertifyCreate(review.reviewContext)
                      : undefined
                  }
                  toConfirm={review.toConfirm}
                  chainId={review.chainId}
                  viewer={review.viewer}
                  selectedCommitmentId={review.routeCommitmentId}
                  onOpenCommitment={review.handleOpenCommitment}
                  onCloseCommitment={review.handleCloseCommitment}
                  onOpenWorkDetail={review.handleOpenWorkDetail}
                  onClearSearch={review.handleClearSearch}
                  onOpenCertification={review.handleOpenCertification}
                  onOpenHypercert={review.handleOpenHypercert}
                  reviewBatch={review.reviewBatch}
                  olderWork={review.olderWork}
                  olderHypercerts={review.olderHypercerts}
                />
              </div>
            </section>
          </CanvasRouteContent>
        </div>
      )}
    </CanvasRouteFrame>
  );
}
