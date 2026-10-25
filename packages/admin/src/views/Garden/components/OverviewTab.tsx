import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useActionsByUID } from "@green-goods/shared/hooks/action/useAction";
import type { AdminWorkspaceSectionTab } from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import {
  useLocalizedEventTime,
  useLocalizedRelativeTime,
} from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import type { KarmaIntegrationController } from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenDetailTab,
  GardenRange,
} from "@green-goods/shared/types/garden-detail";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { RiArrowRightSLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { localizeWorkActivityTitle } from "@/components/Action/actionDisplay";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { type GardenAlert, GardenAlertsCard } from "./GardenAlertsCard";
import { formatReviewTime, SectionStateCard } from "./GardenDetailHelpers";
import {
  ACTIVITY_CARD_CLASS,
  RANGE_OPTIONS,
  SECTION_CARD_MIN_HEIGHT,
} from "./gardenDetail.constants";
import { KarmaIntegrationPanel } from "./KarmaIntegrationPanel";

export interface OverviewTabProps {
  chainId?: number;
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
  overviewAlerts: GardenAlert[];
  gardenHealthLabel: string;
  approvedInRangeCount: number;
  impactVelocityDelta: number;
  /** Median time from submission to decision; null before any decision has a known time. */
  medianReviewLatencyMs: number | null;
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
  chainId,
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
  medianReviewLatencyMs,
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
  const intl = useIntl();
  const { formatMessage } = intl;
  const formatActivityTime = useLocalizedRelativeTime();
  const formatEventTime = useLocalizedEventTime();
  // Below the 1024px desktop split, alerts lead the stacked main column;
  // the rest of the rail still follows (DL-051).
  const alertsLead = !useMediaQuery("(min-width: 1024px)");
  const alertsCard = <GardenAlertsCard alerts={overviewAlerts} />;
  const isHealthMode = mode === "health";
  const isActivityMode = mode === "activity";
  const activityEventLimit = isActivityMode ? Number.POSITIVE_INFINITY : 8;
  const actions = useActionsByUID(
    filteredActivityEvents
      .slice(0, activityEventLimit)
      .flatMap((event) => (event.actionUID === undefined ? [] : [event.actionUID])),
    chainId
  );
  const formatActivityTitle = (event: GardenActivityEvent) =>
    event.category === "work"
      ? localizeWorkActivityTitle(
          event.title,
          findActionByUID(actions, event.actionUID ?? null),
          intl,
          event.hasGeneratedTitle
        )
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
          {alertsLead ? alertsCard : null}

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
            <AdminCard density="none" className={SECTION_CARD_MIN_HEIGHT}>
              <AdminCardHeader className="flex-wrap gap-3">
                <div>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.health.title" })}
                  </AdminCardTitle>
                  <p className="mt-1 type-body text-text-sub">{gardenHealthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {RANGE_OPTIONS.map((range) => (
                    <AdminFilterChip
                      key={range}
                      label={formatMessage({ id: `app.garden.detail.range.${range}` })}
                      selected={selectedRange === range}
                      onToggle={() => updateQueryState({ range })}
                    />
                  ))}
                </div>
              </AdminCardHeader>
              <AdminCardBody>
                {/* Grouped by proximity inside the one card, not boxed again (D33). */}
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
                  <div>
                    <dt className="type-label-sm text-text-soft">
                      {formatMessage({
                        id: "app.garden.detail.metric.lastActivity",
                        defaultMessage: "Last Activity",
                      })}
                    </dt>
                    <dd className="mt-1 font-heading type-title-md font-semibold text-text-strong">
                      {filteredActivityEvents.length > 0
                        ? formatActivityTime(filteredActivityEvents[0].timestamp)
                        : formatMessage({
                            id: "app.garden.detail.metric.noActivity",
                            defaultMessage: "No activity yet",
                          })}
                    </dd>
                  </div>
                  <div>
                    <dt className="type-label-sm text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                    </dt>
                    <dd className="mt-1 font-heading type-title-md font-semibold text-text-strong">
                      {approvedInRangeCount}
                    </dd>
                    <dd className="mt-0.5 type-meta text-text-soft">
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
                    </dd>
                  </div>
                  <div>
                    <dt className="type-label-sm text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.executionThroughput" })}
                    </dt>
                    <dd className="mt-1 font-heading type-title-md font-semibold text-text-strong">
                      {formatReviewTime(medianReviewLatencyMs, formatMessage)}
                    </dd>
                  </div>
                </dl>
                <FactList frame="inset" className="mt-4 border-t border-stroke-soft">
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
                    value={pendingWorkCount}
                  />
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
                    value={assessmentCount30d}
                  />
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
                    value={gardenerCount}
                  />
                  <FactRow
                    label={formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
                    value={treasuryBalance}
                  />
                </FactList>
              </AdminCardBody>
            </AdminCard>
          )}

          {isActivityMode && (section === undefined || section === "activity") && (
            <AdminCard density="none" className={ACTIVITY_CARD_CLASS}>
              <AdminCardHeader className="flex-wrap gap-3">
                <div>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.activity.title" })}
                  </AdminCardTitle>
                  <p className="mt-1 type-body text-text-sub">
                    {formatMessage({ id: "app.garden.detail.activity.description" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "work", "impact", "community"] as ActivityFilter[]).map((filter) => (
                    <AdminFilterChip
                      key={filter}
                      label={formatMessage({ id: `app.garden.detail.activity.filter.${filter}` })}
                      selected={activityFilter === filter}
                      onToggle={() => setActivityFilter(filter)}
                    />
                  ))}
                </div>
              </AdminCardHeader>
              <AdminCardBody>
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
                                <p className="mb-1 inline-flex rounded-full bg-bg-soft px-2 py-0.5 type-meta-sm font-medium text-text-sub">
                                  {formatMessage({
                                    id: `app.garden.detail.activity.filter.${event.category}`,
                                  })}
                                </p>
                                <p
                                  className="truncate type-body font-medium text-text-strong"
                                  title={activityTitle}
                                >
                                  {activityTitle}
                                </p>
                                <p className="mt-1 max-w-prose type-meta text-text-soft">
                                  {event.description}
                                </p>
                              </div>
                              <span className="type-meta text-text-soft">
                                {formatEventTime(event.timestamp)}
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
                                  className="inline-flex items-center gap-1 type-label-sm text-primary-base hover:text-primary-darker"
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
                      <Button
                        type="button"
                        emphasis="tertiary"
                        size="compact"
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
                      </Button>
                    )}
                  </>
                )}
              </AdminCardBody>
            </AdminCard>
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            {alertsLead ? null : alertsCard}

            {isHealthMode ? <KarmaIntegrationPanel integration={karmaIntegration} /> : null}

            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {isActivityMode
                    ? formatMessage({ id: "app.garden.detail.keyMetrics" })
                    : formatMessage({ id: "app.garden.detail.activity.title" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody className="space-y-2">
                {isActivityMode ? (
                  <FactList frame="inset">
                    <FactRow
                      label={formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
                      value={pendingWorkCount}
                    />
                    <FactRow
                      label={formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
                      value={assessmentCount30d}
                    />
                    <FactRow
                      label={formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
                      value={gardenerCount}
                    />
                    <FactRow
                      label={formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
                      value={treasuryBalance}
                    />
                  </FactList>
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
                            {formatEventTime(event.timestamp)}
                          </span>
                        </button>
                      );
                    })}
                    {filteredActivityEvents.length === 0 ? (
                      <p className="type-body text-text-soft">
                        {formatMessage({ id: "app.garden.detail.activity.empty" })}
                      </p>
                    ) : null}
                  </>
                )}
              </AdminCardBody>
            </AdminCard>
          </div>
        </aside>
      </div>
    </div>
  );
}
