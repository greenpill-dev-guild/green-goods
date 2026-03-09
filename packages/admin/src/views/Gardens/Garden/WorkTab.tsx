import { formatDate, formatRelativeTime, type GardenDetailTab, getStatusColors } from "@green-goods/shared";
import { RiCloseLine, RiInboxLine, RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkSubmissionsView } from "@/components/Work/WorkSubmissionsView";
import { SectionStateCard } from "./GardenDetailHelpers";

export interface WorkTabProps {
  garden: { id: string };
  canReview: boolean;
  section: string | undefined;
  selectedItem: string | undefined;
  clearSection: () => void;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
  works: Array<{ id: string; title?: string; status: string; createdAt: number }>;
  worksLoading: boolean;
  worksFetching: boolean;
  refreshWorkData: () => void;
  lastWorkRefreshAt: number;
  pendingWorks: Array<{ id: string }>;
  pendingWarningCount: number;
  pendingCriticalCount: number;
  reviewedWorks: Array<{ id: string; title?: string; status: string; createdAt: number }>;
  approvedWorks: Array<{ id: string }>;
  medianReviewAgeHours: number;
}

export function WorkTab({
  garden,
  canReview,
  section,
  selectedItem,
  clearSection,
  openSection,
  works,
  worksLoading,
  worksFetching,
  refreshWorkData,
  lastWorkRefreshAt,
  pendingWorks,
  pendingWarningCount,
  pendingCriticalCount,
  reviewedWorks,
  approvedWorks,
  medianReviewAgeHours,
}: WorkTabProps) {
  const { formatMessage } = useIntl();

  const approvalRate =
    reviewedWorks.length > 0 ? Math.round((approvedWorks.length / reviewedWorks.length) * 100) : 0;

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          {selectedItem?.startsWith("age-") && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-alpha-16 px-3 py-1 text-xs font-medium text-primary-darker">
                {selectedItem === "age-24h"
                  ? formatMessage({
                      id: "app.garden.detail.work.filterAge24h",
                      defaultMessage: "Pending 24h+",
                    })
                  : formatMessage({
                      id: "app.garden.detail.work.filterAge72h",
                      defaultMessage: "Pending 72h+",
                    })}
                <button
                  type="button"
                  onClick={() => clearSection()}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary-alpha-16"
                  aria-label={formatMessage({
                    id: "app.garden.detail.work.clearFilter",
                    defaultMessage: "Clear filter",
                  })}
                >
                  <RiCloseLine className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          {(section === undefined || section === "decisions") && (
            <Card>
              <Card.Header className="flex-wrap gap-3">
                <h3 className="label-md text-text-strong sm:text-lg">
                  {formatMessage({ id: "app.garden.detail.work.recentDecisions" })}
                </h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openSection("work", "decisions")}
                >
                  {formatMessage({ id: "app.actions.view" })}
                </Button>
              </Card.Header>
              <Card.Body>
                {reviewedWorks.length === 0 ? (
                  <EmptyState
                    icon={<RiInboxLine className="h-6 w-6" />}
                    title={formatMessage({ id: "app.garden.detail.work.noDecisions" })}
                  />
                ) : (
                  <div className="space-y-2">
                    {reviewedWorks.slice(0, section === "decisions" ? 12 : 5).map((work) => (
                      <div
                        key={work.id}
                        className={`flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 ${
                          selectedItem && work.id === selectedItem ? "ring-1 ring-primary-base" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium text-text-strong"
                            title={work.title || undefined}
                          >
                            {work.title || formatMessage({ id: "app.admin.work.untitledWork" })}
                          </p>
                          <p className="mt-0.5 text-xs text-text-soft">
                            {formatDate(work.createdAt, { dateStyle: "medium" })}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColors(work.status).combined}`}
                        >
                          {formatMessage({
                            id: `app.admin.work.filter.${work.status}`,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {(section === undefined || section === "queue" || section === "history") && (
            <WorkSubmissionsView
              gardenId={garden.id}
              canManage={canReview}
              works={works}
              isLoading={worksLoading}
              isRefreshing={worksFetching}
              onRefresh={refreshWorkData}
              lastUpdatedAt={lastWorkRefreshAt}
              initialFilter={section === "history" ? "all" : "pending"}
              highlightWorkId={selectedItem}
            />
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header className="flex-wrap gap-3">
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.work.commandCenter" })}
                </h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={refreshWorkData}
                  loading={worksFetching}
                >
                  {!worksFetching && <RiRefreshLine className="h-4 w-4" />}
                  {formatMessage({ id: "app.garden.detail.action.refresh" })}
                </Button>
              </Card.Header>
              <Card.Body>
                <p className="text-xs text-text-soft">
                  {formatMessage(
                    { id: "app.garden.detail.work.lastUpdated" },
                    { when: formatRelativeTime(lastWorkRefreshAt) }
                  )}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pendingQueue" })}</span>
                    <span className="font-semibold text-text-strong">{pendingWorks.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue", "age-24h")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pending24h" })}</span>
                    <span className="font-semibold text-text-strong">{pendingWarningCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue", "age-72h")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pending72h" })}</span>
                    <span className="font-semibold text-text-strong">{pendingCriticalCount}</span>
                  </button>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.reviewStats" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <div className="garden-stat-row">
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.reviewStats.totalReviewed" })}
                  </span>
                  <span className="garden-stat-row-value">{reviewedWorks.length}</span>
                </div>
                <div className="garden-stat-row">
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.reviewStats.approvalRate" })}
                  </span>
                  <span className="garden-stat-row-value">{approvalRate}%</span>
                </div>
                <div className="garden-stat-row">
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.reviewStats.medianReviewTime" })}
                  </span>
                  <span className="garden-stat-row-value">
                    {medianReviewAgeHours > 0
                      ? formatMessage(
                          { id: "app.garden.detail.metric.hoursValue" },
                          { hours: Math.round(medianReviewAgeHours) }
                        )
                      : formatMessage({ id: "app.garden.detail.metric.notAvailable" })}
                  </span>
                </div>
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
