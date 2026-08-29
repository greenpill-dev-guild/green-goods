import { Card } from "@green-goods/shared/components/Cards/CardBase";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { AdminWorkspaceSectionTab } from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenDetailTab,
  GardenRange,
  TabBadgeSeverity,
} from "@green-goods/shared/types/garden-detail";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import type { KarmaIntegrationController } from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import { RiArrowRightSLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { localizeCanonicalActionTitle } from "@/views/Hub/actionDisplay";
import { AlertRow, SectionStateCard } from "./GardenDetailHelpers";
import {
  ACTIVITY_CARD_CLASS,
  RANGE_OPTIONS,
  SECTION_CARD_MIN_HEIGHT,
} from "./gardenDetail.constants";
import { KarmaIntegrationPanel } from "./KarmaIntegrationPanel";

export interface OverviewTabProps {
  mode: "health" | "activity";
  section: string | undefined;
  selectedItem: string | undefined;
  selectedRange: GardenRange;
  clearSection: () => void;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
  updateQueryState: (
    updates: {
      tab?: AdminWorkspaceSectionTab;
      range?: string;
      section?: string;
      item?: string;
    },
    replace?: boolean
  ) => void;
  overviewAlerts: Array<{
    key: string;
    severity: Exclude<TabBadgeSeverity, "none">;
    label: string;
    onAction: () => void;
  }>;
  gardenHealthLabel: string;
  approvedInRangeCount: number;
  impactVelocityDelta: number;
  medianReviewAgeHours: number;
  activityFilter: ActivityFilter;
  setActivityFilter: (filter: ActivityFilter) => void;
  filteredActivityEvents: GardenActivityEvent[];
  isLoading?: boolean;
  pendingWorkCount: number;
  assessmentCount30d: number;
  gardenerCount: number;
  treasuryBalance: string;
  karmaIntegration: KarmaIntegrationController;
}

export function OverviewTab({
  mode,
  section,
  selectedItem,
  selectedRange,
  clearSection,
  openSection,
  updateQueryState,
  overviewAlerts,
  gardenHealthLabel,
  approvedInRangeCount,
  impactVelocityDelta,
  medianReviewAgeHours,
  activityFilter,
  setActivityFilter,
  filteredActivityEvents,
  isLoading,
  pendingWorkCount,
  assessmentCount30d,
  gardenerCount,
  treasuryBalance,
  karmaIntegration,
}: OverviewTabProps) {
  const { formatMessage } = useIntl();
  const formatActivityTime = useLocalizedRelativeTime();
  const isHealthMode = mode === "health";
  const isActivityMode = mode === "activity";
  const activityEventLimit = isActivityMode ? Number.POSITIVE_INFINITY : 8;
  const formatActivityTitle = (event: GardenActivityEvent) =>
    event.category === "work"
      ? localizeCanonicalActionTitle(event.title, formatMessage)
      : event.title;

  if (isLoading) {
    return (
      <div className="garden-tab-shell" role="status" aria-live="polite">
        <span className="sr-only">
          {formatMessage({
            id: "app.garden.detail.overview.loading",
            defaultMessage: "Loading overview data...",
          })}
        </span>
        <div className="garden-tab-layout">
          <div className="garden-tab-main space-y-4">
            <div className="h-52 rounded-lg skeleton-shimmer" />
            <div className="h-64 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
          <aside className="garden-tab-rail">
            <div className="garden-tab-rail-sticky space-y-4">
              <div
                className="h-28 rounded-lg skeleton-shimmer"
                style={{ animationDelay: "0.15s" }}
              />
              <div
                className="h-40 rounded-lg skeleton-shimmer"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          </aside>
        </div>
      </div>
    );
  }

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

          {isHealthMode && (section === undefined || section === "health") && (
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="admin-section-title">
                    {formatMessage({ id: "app.garden.detail.health.title" })}
                  </h3>
                  <p className="mt-1 body-sm text-text-sub">{gardenHealthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {RANGE_OPTIONS.map((range) => (
                    <AdminButton
                      key={range}
                      type="button"
                      variant={selectedRange === range ? "tonal" : "text"}
                      size="sm"
                      onClick={() => updateQueryState({ range })}
                      className="px-2.5 py-1"
                    >
                      {formatMessage({ id: `app.garden.detail.range.${range}` })}
                    </AdminButton>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-live="polite">
                  <AdminCard variant="outlined" density="compact">
                    <p className="label-xs text-text-soft">
                      {formatMessage({
                        id: "app.garden.detail.metric.lastActivity",
                        defaultMessage: "Last Activity",
                      })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {filteredActivityEvents.length > 0
                        ? formatActivityTime(filteredActivityEvents[0].timestamp)
                        : formatMessage({
                            id: "app.garden.detail.metric.noActivity",
                            defaultMessage: "No activity yet",
                          })}
                    </p>
                  </AdminCard>
                  <AdminCard variant="outlined" density="compact">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {approvedInRangeCount}
                    </p>
                    <p className="mt-0.5 body-xs text-text-soft">
                      {impactVelocityDelta === 0
                        ? formatMessage({ id: "app.garden.detail.metric.noDelta" })
                        : formatMessage(
                            {
                              id:
                                impactVelocityDelta > 0
                                  ? "app.garden.detail.metric.deltaUp"
                                  : "app.garden.detail.metric.deltaDown",
                            },
                            { count: Math.abs(impactVelocityDelta) }
                          )}
                    </p>
                  </AdminCard>
                  <AdminCard variant="outlined" density="compact">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.executionThroughput" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {medianReviewAgeHours > 0
                        ? formatMessage(
                            { id: "app.garden.detail.metric.hoursValue" },
                            { hours: Math.round(medianReviewAgeHours) }
                          )
                        : formatMessage({ id: "app.garden.detail.metric.notAvailable" })}
                    </p>
                  </AdminCard>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
                    </span>
                    <span className="garden-stat-row-value">{pendingWorkCount}</span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
                    </span>
                    <span className="garden-stat-row-value">{assessmentCount30d}</span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
                    </span>
                    <span className="garden-stat-row-value">{gardenerCount}</span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
                    </span>
                    <span className="garden-stat-row-value">{treasuryBalance}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {isActivityMode && (section === undefined || section === "activity") && (
            <Card className={ACTIVITY_CARD_CLASS}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="admin-section-title">
                    {formatMessage({ id: "app.garden.detail.activity.title" })}
                  </h3>
                  <p className="mt-1 body-sm text-text-sub">
                    {formatMessage({ id: "app.garden.detail.activity.description" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "work", "impact", "community"] as ActivityFilter[]).map((filter) => (
                    <AdminButton
                      key={filter}
                      type="button"
                      variant={activityFilter === filter ? "tonal" : "text"}
                      size="sm"
                      onClick={() => setActivityFilter(filter)}
                      className="px-2.5 py-1"
                    >
                      {formatMessage({ id: `app.garden.detail.activity.filter.${filter}` })}
                    </AdminButton>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                {filteredActivityEvents.length === 0 ? (
                  <EmptyState
                    icon={<RiTimeLine className="h-6 w-6" />}
                    title={
                      activityFilter !== "all"
                        ? formatMessage(
                            {
                              id: "app.garden.detail.activity.emptyFiltered",
                              defaultMessage: "No {filter} activity in this period",
                            },
                            {
                              filter: formatMessage({
                                id: `app.garden.detail.activity.filter.${activityFilter}`,
                              }),
                            }
                          )
                        : formatMessage({ id: "app.garden.detail.activity.empty" })
                    }
                    description={formatMessage({
                      id: "app.garden.detail.activity.emptyDescription",
                    })}
                  />
                ) : (
                  <>
                    <div className="relative space-y-3 before:absolute before:bottom-3 before:left-[0.6875rem] before:top-3 before:w-px before:bg-stroke-soft">
                      {filteredActivityEvents.slice(0, activityEventLimit).map((event) => {
                        const categoryBorder =
                          event.category === "work"
                            ? "border-l-success-base"
                            : event.category === "impact"
                              ? "border-l-information-base"
                              : "border-l-warning-base";
                        const activityTitle = formatActivityTitle(event);
                        return (
                          <div
                            key={event.id}
                            className={`relative ml-6 rounded-lg border border-stroke-soft border-l-4 ${categoryBorder} bg-bg-weak p-3 ${
                              selectedItem && event.itemId === selectedItem
                                ? "ring-1 ring-primary-base"
                                : ""
                            }`}
                          >
                            <span
                              className="absolute -left-[1.95rem] top-4 h-3 w-3 rounded-full border-2 border-bg-white bg-primary-base"
                              aria-hidden="true"
                            />
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="mb-1 inline-flex rounded-full bg-bg-soft px-2 py-0.5 text-label-sm font-medium text-text-sub">
                                  {formatMessage({
                                    id: `app.garden.detail.activity.filter.${event.category}`,
                                  })}
                                </p>
                                <p
                                  className="truncate text-sm font-medium text-text-strong"
                                  title={activityTitle}
                                >
                                  {activityTitle}
                                </p>
                                <p className="mt-1 max-w-prose body-xs text-text-soft">
                                  {event.description}
                                </p>
                              </div>
                              <span className="body-xs text-text-soft">
                                {formatActivityTime(event.timestamp)}
                              </span>
                            </div>
                            {event.href ? (
                              <div className="mt-2">
                                <Link
                                  to={event.href}
                                  onClick={() => {
                                    if (
                                      event.category === "work" &&
                                      (!event.href || event.href.startsWith("/hub/work/"))
                                    ) {
                                      openSection("work", "work", event.itemId);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                                >
                                  {formatMessage({ id: "app.garden.detail.activity.view" })}
                                  <RiArrowRightSLine className="h-4 w-4" />
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {filteredActivityEvents.length > activityEventLimit && (
                      <AdminButton
                        type="button"
                        variant="text"
                        size="sm"
                        onClick={() => openSection("overview", "activity")}
                        className="mt-3 w-full"
                      >
                        {formatMessage(
                          {
                            id: "app.garden.detail.activity.viewAll",
                            defaultMessage: "View all {count} activities",
                          },
                          { count: filteredActivityEvents.length }
                        )}
                      </AdminButton>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            {isHealthMode ? <KarmaIntegrationPanel integration={karmaIntegration} /> : null}

            <Card>
              <Card.Header>
                <h3 className="admin-section-title admin-section-title--compact">
                  {formatMessage({ id: "app.garden.detail.alerts.title" })}
                </h3>
              </Card.Header>
              <Card.Body>
                {overviewAlerts.length === 0 ? (
                  <p className="body-sm text-text-soft">
                    {formatMessage({ id: "app.garden.detail.alerts.none" })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {overviewAlerts.map((alert) => (
                      <AlertRow
                        key={alert.key}
                        severity={alert.severity}
                        label={alert.label}
                        actionLabel={formatMessage({ id: "app.actions.view" })}
                        onAction={alert.onAction}
                      />
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="admin-section-title admin-section-title--compact">
                  {isActivityMode
                    ? formatMessage({ id: "app.garden.detail.keyMetrics" })
                    : formatMessage({ id: "app.garden.detail.activity.title" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                {isActivityMode ? (
                  <>
                    <div className="garden-stat-row">
                      <span className="garden-stat-row-label">
                        {formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
                      </span>
                      <span className="garden-stat-row-value">{pendingWorkCount}</span>
                    </div>
                    <div className="garden-stat-row">
                      <span className="garden-stat-row-label">
                        {formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
                      </span>
                      <span className="garden-stat-row-value">{assessmentCount30d}</span>
                    </div>
                    <div className="garden-stat-row">
                      <span className="garden-stat-row-label">
                        {formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
                      </span>
                      <span className="garden-stat-row-value">{gardenerCount}</span>
                    </div>
                    <div className="garden-stat-row">
                      <span className="garden-stat-row-label">
                        {formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
                      </span>
                      <span className="garden-stat-row-value">{treasuryBalance}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {filteredActivityEvents.slice(0, 3).map((event) => {
                      const activityTitle = formatActivityTitle(event);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className="garden-stat-row w-full text-left"
                          onClick={() => openSection("overview", "activity", event.itemId)}
                        >
                          <span className="min-w-0 truncate garden-stat-row-label">
                            {activityTitle}
                          </span>
                          <span className="shrink-0 garden-stat-row-value">
                            {formatActivityTime(event.timestamp)}
                          </span>
                        </button>
                      );
                    })}
                    {filteredActivityEvents.length === 0 ? (
                      <p className="body-sm text-text-soft">
                        {formatMessage({ id: "app.garden.detail.activity.empty" })}
                      </p>
                    ) : null}
                  </>
                )}
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
