import { type Address, formatRelativeTime } from "@green-goods/shared";
import { RiArrowRightSLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

import { AlertRow, SectionStateCard } from "./GardenDetailHelpers";
import { RANGE_OPTIONS, SECTION_CARD_MIN_HEIGHT } from "./gardenDetail.constants";
import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenRange,
  GardenTab,
  TabBadgeSeverity,
} from "./gardenDetail.types";

export interface OverviewTabProps {
  garden: {
    id: string;
    name: string;
    description?: string;
    tokenAddress: string;
    tokenID: string;
    chainId: number;
    domainMask?: number;
  };
  canManage: boolean;
  isOwner: boolean;
  section: string | undefined;
  selectedItem: string | undefined;
  selectedRange: GardenRange;
  clearSection: () => void;
  openSection: (tab: GardenTab, section: string, itemId?: string) => void;
  updateQueryState: (
    updates: Partial<Record<"tab" | "range" | "section" | "item", string | undefined>>,
    replace?: boolean
  ) => void;
  setTab: (tab: GardenTab) => void;
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
  pendingWorkCount: number;
  assessmentCount30d: number;
  gardenerCount: number;
  treasuryBalance: string;
}

export function OverviewTab({
  garden,
  canManage,
  isOwner,
  section,
  selectedItem,
  selectedRange,
  clearSection,
  openSection,
  updateQueryState,
  setTab,
  overviewAlerts,
  gardenHealthLabel,
  approvedInRangeCount,
  impactVelocityDelta,
  medianReviewAgeHours,
  activityFilter,
  setActivityFilter,
  filteredActivityEvents,
  pendingWorkCount,
  assessmentCount30d,
  gardenerCount,
  treasuryBalance,
}: OverviewTabProps) {
  const { formatMessage } = useIntl();

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

          {canManage && section === "metadata" ? (
            <>
              <GardenSettingsEditor
                gardenAddress={garden.id as Address}
                garden={garden}
                canManage={canManage}
                isOwner={isOwner}
              />
              <GardenMetadata
                gardenId={garden.id}
                tokenAddress={garden.tokenAddress}
                tokenId={garden.tokenID}
                chainId={garden.chainId}
              />
            </>
          ) : null}

          {(section === undefined || section === "health") && (
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.health.title" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">{gardenHealthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {RANGE_OPTIONS.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => updateQueryState({ range })}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedRange === range
                          ? "bg-primary-alpha-16 text-primary-darker"
                          : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                      }`}
                    >
                      {formatMessage({ id: `app.garden.detail.range.${range}` })}
                    </button>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.gardenHealth" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {gardenHealthLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {approvedInRangeCount}
                    </p>
                    <p className="mt-0.5 text-xs text-text-soft">
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
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
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
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {(section === undefined || section === "activity") && (
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.activity.title" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">
                    {formatMessage({ id: "app.garden.detail.activity.description" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "work", "impact", "community"] as ActivityFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActivityFilter(filter)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        activityFilter === filter
                          ? "bg-primary-alpha-16 text-primary-darker"
                          : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                      }`}
                    >
                      {formatMessage({ id: `app.garden.detail.activity.filter.${filter}` })}
                    </button>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                {filteredActivityEvents.length === 0 ? (
                  <EmptyState
                    icon={<RiTimeLine className="h-6 w-6" />}
                    title={formatMessage({ id: "app.garden.detail.activity.empty" })}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredActivityEvents
                      .slice(0, section === "activity" ? 14 : 8)
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-lg border border-stroke-soft bg-bg-weak p-3 ${
                            selectedItem && event.itemId === selectedItem
                              ? "ring-1 ring-primary-base"
                              : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-text-strong">
                                {event.title}
                              </p>
                              <p className="mt-1 text-xs text-text-soft">{event.description}</p>
                            </div>
                            <span className="text-xs text-text-soft">
                              {formatRelativeTime(event.timestamp)}
                            </span>
                          </div>
                          {event.href ? (
                            <div className="mt-2">
                              <Link
                                to={event.href}
                                onClick={() => {
                                  if (event.category === "work") {
                                    openSection("work", "queue", event.itemId);
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
                      ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.alerts.title" })}
                </h3>
              </Card.Header>
              <Card.Body>
                {overviewAlerts.length === 0 ? (
                  <p className="text-sm text-text-soft">
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
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.keyMetrics" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTab("work")}
                  className="garden-stat-row w-full"
                >
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="garden-stat-row-value">{pendingWorkCount}</span>
                    <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("impact")}
                  className="garden-stat-row w-full"
                >
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="garden-stat-row-value">{assessmentCount30d}</span>
                    <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("community")}
                  className="garden-stat-row w-full"
                >
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="garden-stat-row-value">{gardenerCount}</span>
                    <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openSection("community", "treasury")}
                  className="garden-stat-row w-full"
                >
                  <span className="garden-stat-row-label">
                    {formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="garden-stat-row-value">{treasuryBalance}</span>
                    <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                  </span>
                </button>
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
