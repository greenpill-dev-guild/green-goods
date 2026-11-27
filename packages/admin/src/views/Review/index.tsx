import { Alert } from "@green-goods/shared/components/Alert";
import { MetaStrip } from "@green-goods/shared/components/Canvas/MetaStrip";
import {
  buildReviewHeaderStats,
  REVIEW_STAGE_RAIL_ID,
} from "@green-goods/shared/hooks/admin-ui/review/review.utils";
import { useReviewWorkbenchController } from "@green-goods/shared/hooks/admin-ui/review/useReviewWorkbenchController";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { Button } from "@green-goods/shared/components/Button";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiCalendarLine } from "@remixicon/react";
import { useMemo } from "react";
import { defineMessages, useIntl } from "react-intl";
import { Link } from "react-router-dom";
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

const WAITING_BAND_LABEL = defineMessages({
  under2d: { id: "hub.review.work.waiting.under2d", defaultMessage: "Under 2 Days" },
  days2to7: { id: "hub.review.work.waiting.days2to7", defaultMessage: "2 to 7 Days" },
  weeks1to2: { id: "hub.review.work.waiting.weeks1to2", defaultMessage: "1 to 2 Weeks" },
  over2w: { id: "hub.review.work.waiting.over2w", defaultMessage: "Over 2 Weeks" },
});

export default function ReviewView() {
  const { formatMessage, formatDate } = useIntl();
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
        // A day opened from the calendar knows which works' statuses it could not read.
        unknownWorkIds={review.workDay ? review.workDayUnknownIds : undefined}
        dayStatusUnread={!review.workDayStatusKnown}
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
                      {/* One day's work, opened from the Activity calendar: the chip names the
                          day and pressing it returns to the usual queue. */}
                      {review.workDayDate ? (
                        <AdminFilterChip
                          label={formatDate(review.workDayDate, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          selected
                          onToggle={review.handleClearWorkDay}
                        />
                      ) : null}
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
                    {/* How long pending work has waited (PRD-1577). Plain ink, never a
                        warning: age is information (DL-044). Not on a day's list. */}
                    {review.workDay ? null : (
                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label={formatMessage({
                          id: "hub.review.work.waiting",
                          defaultMessage: "Waiting time",
                        })}
                      >
                        {review.waitingBands.map((band) => (
                          <AdminFilterChip
                            key={band.id}
                            label={formatMessage(
                              review.waitingBandsComplete
                                ? {
                                    id: "hub.review.work.waiting.count",
                                    defaultMessage: "{band} ({count})",
                                  }
                                : {
                                    id: "hub.review.work.waiting.atLeast",
                                    defaultMessage: "{band} ({count}+)",
                                  },
                              {
                                band: formatMessage(WAITING_BAND_LABEL[band.id]),
                                count: band.count,
                              }
                            )}
                            selected={review.waitingBand === band.id}
                            // An empty band has nothing to show, unless its count is only a minimum.
                            disabled={
                              band.count === 0 &&
                              review.waitingBandsComplete &&
                              review.waitingBand !== band.id
                            }
                            onToggle={() => review.handleWaitingBandChange(band.id)}
                          />
                        ))}
                      </div>
                    )}
                    <AdminSortSelect
                      value={review.sortDirection}
                      onChange={(value) => review.updateSearch({ sort: value }, false)}
                      options={review.sortOptions}
                    />
                    {review.workDayCalendarHref ? (
                      <Button asChild size="compact" emphasis="tertiary">
                        <Link to={review.workDayCalendarHref}>
                          <RiCalendarLine aria-hidden className="h-4 w-4" />
                          {formatMessage({
                            id: "hub.review.work.backToCalendar",
                            defaultMessage: "Back to Calendar",
                          })}
                        </Link>
                      </Button>
                    ) : null}
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
              {/* Older paging is off on a day, so a day too busy for one read says so. */}
              {review.stage === "work" && review.workDay && !review.workDayComplete ? (
                <Alert
                  variant="warning"
                  title={formatMessage({
                    id: "hub.review.work.dayPartial.title",
                    defaultMessage: "This day is only partly read",
                  })}
                >
                  {formatMessage({
                    id: "hub.review.work.dayPartial.description",
                    defaultMessage:
                      "It holds more work than one read lists, so its latest submissions are missing.",
                  })}
                </Alert>
              ) : null}
              <div className="review-results-pane">
                <ReviewStageContent
                  stage={review.stage}
                  works={review.scopedWorks}
                  workScope={review.workScope}
                  unknownIds={review.workDay ? review.workDayUnknownIds : undefined}
                  onShowWholeDay={review.handleShowWholeDay}
                  onClearWaitingBand={
                    review.waitingBand
                      ? () => review.handleWaitingBandChange(review.waitingBand!)
                      : undefined
                  }
                  assessments={review.assessmentList}
                  hypercerts={review.hypercertList}
                  // Oldest first lists nothing until the whole history is read. A day's
                  // list waits on its own read.
                  worksLoading={
                    review.workDay
                      ? review.workDayLoading
                      : review.worksLoading || review.readsWorkHistory
                  }
                  fetchingAssessments={review.fetchingAssessments}
                  hypercertsLoading={review.hypercertsLoading}
                  hasDataError={review.workDay ? review.workDayUnread : review.hasDataError}
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
                  // A day's list is for reading and opening: batch review and older pages
                  // belong to the queue, which holds the works they act on.
                  reviewBatch={review.workDay ? undefined : review.reviewBatch}
                  // A day is read on its own, and a band whose oldest work is in needs no
                  // older page, so neither offers one.
                  olderWork={
                    review.workDay || (review.waitingBand && !review.needsOlderWork)
                      ? undefined
                      : review.olderWork
                  }
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
