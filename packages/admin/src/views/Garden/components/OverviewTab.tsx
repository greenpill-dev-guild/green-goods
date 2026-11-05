import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import { Fragment, useState } from "react";
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
import { RiLeafLine, RiGroupLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
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
import { GardenSetupPanel } from "./GardenSetupCard";
import { KarmaIntegrationPanel } from "./KarmaIntegrationPanel";

export interface OverviewTabProps {
  chainId?: number;
  gardenId: string;
  canManage: boolean;
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
  gardenId,
  canManage,
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
  const navigate = useNavigate();
  const [page, setPage] = useState({ filter: activityFilter, limit: 20 });
  const activityEventLimit = page.filter === activityFilter ? page.limit : 20;
  const { formatMessage } = intl;
  const formatActivityTime = useLocalizedRelativeTime();
  // Below the 1024px desktop split, alerts lead the stacked main column;
  // the rest of the rail still follows (DL-051).
  const alertsLead = !useMediaQuery("(min-width: 1024px)");
  const alertsCard = <GardenAlertsCard alerts={overviewAlerts} />;
  const isHealthMode = mode === "health";
  const isActivityMode = mode === "activity";
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

  const dayLabel = (event: GardenActivityEvent) =>
    event.timestamp
      ? intl.formatDate(event.timestamp, { dateStyle: "full" })
      : formatMessage({ id: "app.garden.detail.activity.unknownDay" });

  const keyMetrics = (
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
  );

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
            <AdminCard
              density="none"
              className={`${SECTION_CARD_MIN_HEIGHT} garden-tab-main-own-height`}
            >
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
                  <StatTile
                    label={formatMessage({ id: "app.garden.detail.metric.lastActivity" })}
                    value={
                      filteredActivityEvents.length > 0
                        ? formatActivityTime(filteredActivityEvents[0].timestamp)
                        : formatMessage({ id: "app.garden.detail.metric.noActivity" })
                    }
                  />
                  <StatTile
                    label={formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                    value={intl.formatNumber(approvedInRangeCount)}
                    delta={
                      impactVelocityDelta === 0
                        ? formatMessage({ id: "app.garden.detail.metric.noDelta" })
                        : formatMessage(
                            {
                              id:
                                impactVelocityDelta > 0
                                  ? "app.garden.detail.metric.deltaUp"
                                  : "app.garden.detail.metric.deltaDown",
                            },
                            { count: Math.abs(impactVelocityDelta) }
                          )
                    }
                  />
                  <StatTile
                    label={formatMessage({ id: "app.garden.detail.metric.executionThroughput" })}
                    value={formatReviewTime(medianReviewLatencyMs, formatMessage)}
                  />
                </div>
                <div className="mt-4 border-t border-stroke-soft">{keyMetrics}</div>
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
                    <p className="mb-3 type-meta text-text-soft">
                      {formatMessage(
                        { id: "app.garden.detail.activity.timezone" },
                        {
                          zone:
                            new Intl.DateTimeFormat(intl.locale, { timeZoneName: "short" })
                              .formatToParts()
                              .find((part) => part.type === "timeZoneName")?.value ?? "",
                        }
                      )}
                    </p>
                    <div className="space-y-3">
                      {filteredActivityEvents
                        .slice(0, activityEventLimit)
                        .map((event, index, events) => {
                          const day = dayLabel(event);
                          const previousDay = index > 0 ? dayLabel(events[index - 1]) : null;
                          return (
                            <Fragment key={event.id}>
                              {day !== previousDay ? (
                                <h3 className="type-label-sm font-medium text-text-sub">{day}</h3>
                              ) : null}
                              <ActivityItem
                                event={event}
                                title={formatActivityTitle(event)}
                                selected={Boolean(selectedItem && event.itemId === selectedItem)}
                                showCategory={activityFilter === "all"}
                                onOpen={event.href ? () => navigate(event.href!) : undefined}
                              />
                            </Fragment>
                          );
                        })}
                    </div>
                    {filteredActivityEvents.length > activityEventLimit ? (
                      <Button
                        type="button"
                        emphasis="tertiary"
                        size="sm"
                        onClick={() =>
                          setPage({ filter: activityFilter, limit: activityEventLimit + 20 })
                        }
                        className="mt-3 w-full"
                      >
                        {formatMessage({ id: "app.common.showMore" })}
                      </Button>
                    ) : null}
                  </>
                )}
              </AdminCardBody>
            </AdminCard>
          )}
          {isHealthMode ? (
            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {formatMessage({ id: "app.garden.detail.activity.title" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody className="space-y-3">
                {filteredActivityEvents.slice(0, 3).map((event) => (
                  <ActivityItem
                    key={event.id}
                    event={event}
                    title={formatActivityTitle(event)}
                    showCategory={false}
                    onOpen={event.href ? () => navigate(event.href!) : undefined}
                  />
                ))}
                {filteredActivityEvents.length === 0 ? (
                  <p className="type-body text-text-soft">
                    {formatMessage({ id: "app.garden.detail.activity.empty" })}
                  </p>
                ) : null}
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="sm"
                  onClick={() => openSection("overview", "activity")}
                >
                  {formatMessage(
                    { id: "app.garden.detail.activity.viewAll" },
                    { count: filteredActivityEvents.length }
                  )}
                </Button>
              </AdminCardBody>
            </AdminCard>
          ) : null}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            {alertsLead ? null : alertsCard}

            {isHealthMode ? <GardenSetupPanel gardenId={gardenId} canManage={canManage} /> : null}
            {isHealthMode ? <KarmaIntegrationPanel integration={karmaIntegration} /> : null}

            {isActivityMode ? (
              <AdminCard density="none">
                <AdminCardHeader>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.keyMetrics" })}
                  </AdminCardTitle>
                </AdminCardHeader>
                <AdminCardBody className="space-y-2">{keyMetrics}</AdminCardBody>
              </AdminCard>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActivityItem({
  event,
  title,
  selected,
  showCategory,
  onOpen,
}: {
  event: GardenActivityEvent;
  title: string;
  selected?: boolean;
  showCategory: boolean;
  onOpen?: () => void;
}) {
  const intl = useIntl();
  const actor = useAddressDisplayName(event.actorAddress, { list: true });
  const formatEventTime = useLocalizedEventTime();
  const Icon =
    event.category === "work"
      ? RiLeafLine
      : event.category === "community"
        ? RiGroupLine
        : RiTimeLine;
  const moment = formatEventTime(event.timestamp);
  const category = showCategory
    ? intl.formatMessage({ id: `app.garden.detail.activity.filter.${event.category}` })
    : undefined;
  const detail = actor.display ? `${actor.display} · ${event.description}` : event.description;
  return (
    <ItemRow
      title={title}
      selected={selected}
      onOpen={onOpen}
      lead={
        event.category === "work" && event.photo
          ? {
              kind: "photo",
              src: resolveIPFSUrl(event.photo),
              mark: category,
            }
          : {
              kind: "icon",
              icon: <Icon />,
              mark: category,
            }
      }
      status={
        event.statusLabel
          ? { label: event.statusLabel, tone: event.statusTone ?? "neutral" }
          : undefined
      }
      details={
        moment
          ? [
              detail,
              {
                text: moment,
                tone: "soft",
                dateTime: new Date(event.timestamp).toISOString(),
                title: intl.formatDate(event.timestamp, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              },
            ]
          : [detail]
      }
    />
  );
}
