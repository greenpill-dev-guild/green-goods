/**
 * Garden reporting lab, walkthrough (proposed): Garden's Activity tab with the month
 * calendar above its Activity Feed. The tab's split, the feed card with its chips, day
 * headings and rows, and the rail's alerts and Key Metrics follow `OverviewTab` in activity
 * mode. New here are the calendar, where a day opens its work in a dialog (the way records
 * open across the cockpit) and stays marked while it is open, and Places beneath it, the
 * month's sites with the work that shared no location kept in its own row. A feed row opens
 * its work the same way, as the shipped feed opens Review Work.
 */
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { RiTimeLine } from "@remixicon/react";
import { Fragment, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { GardenAlertsCard } from "@/views/Garden/components/GardenAlertsCard";
import { ACTIVITY_CARD_CLASS } from "@/views/Garden/components/gardenDetail.constants";
import { buildCalendar, statusAt } from "./aggregate";
import { ActivityCalendar } from "./ActivityCalendar";
import { type DayKey, dayKeyOf, formatDay, formatMoment, monthOf } from "./dates";
import { dayRecordsRequest } from "./dayRequest";
import { GardenKeyMetrics, GardenScene } from "./GardenScene";
import { accountName, recordTitle, STATUS_COPY } from "./labCopy";
import type { MediaSet, ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import { PlaceActivity } from "./PlaceActivity";
import { GardenTabLayout } from "./SceneFrames";
import { type ReportScope, scopeRecords, statusMoment } from "./scope";

type FeedFilter = "all" | "work" | "impact" | "community";
const FEED_FILTERS: FeedFilter[] = ["all", "work", "impact", "community"];
const FEED_PAGE = 20;

interface GardenActivitySceneProps {
  dataset: ReportDataset;
  media: MediaSet;
  /** A day whose records the screen opens on. */
  day?: DayKey;
  /** A record the screen opens on: within the day's list when a day is given. */
  openId?: string;
}

function dayOpening(dataset: ReportDataset, day: DayKey | undefined, openId: string | undefined) {
  return (scope: ReportScope, locale: string): RecordsRequest | null => {
    if (!day) return null;
    const calendar = buildCalendar({
      dataset,
      records: scopeRecords(dataset, scope),
      month: monthOf(day),
      groupBy: scope.groupBy,
      at: statusMoment(scope, dataset),
      status: scope.status,
    });
    const cell = calendar.weeks.flat().find((item) => item.day === day);
    return cell ? { ...dayRecordsRequest(cell, dataset, scope, locale), openId } : null;
  };
}

function ActivityFeed({
  dataset,
  media,
  open,
  onOpen,
}: {
  dataset: ReportDataset;
  media: MediaSet;
  open: RecordsRequest | null;
  onOpen: (record: WorkRecord) => void;
}) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [limit, setLimit] = useState(FEED_PAGE);
  const dayOf = (record: WorkRecord) => dayKeyOf(record.submittedAt, garden.timeZone);
  const events =
    filter === "all" || filter === "work"
      ? [...dataset.records].sort((a, b) => b.submittedAt - a.submittedAt)
      : [];

  return (
    <AdminCard density="none" className={ACTIVITY_CARD_CLASS} data-component="GardenActivityFeed">
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
          {FEED_FILTERS.map((item) => (
            <AdminFilterChip
              key={item}
              label={formatMessage({ id: `app.garden.detail.activity.filter.${item}` })}
              selected={filter === item}
              onToggle={() => setFilter(item)}
            />
          ))}
        </div>
      </AdminCardHeader>
      <AdminCardBody>
        {events.length === 0 ? (
          <EmptyState
            icon={<RiTimeLine className="h-6 w-6" />}
            title={formatMessage(
              {
                id: "app.garden.detail.activity.emptyFiltered",
                defaultMessage: "No {filter} activity in this period",
              },
              { filter: formatMessage({ id: `app.garden.detail.activity.filter.${filter}` }) }
            )}
            description={formatMessage({ id: "app.garden.detail.activity.emptyDescription" })}
          />
        ) : (
          <>
            <p className="mb-3 type-meta text-text-soft">
              {formatMessage(
                { id: "app.garden.detail.activity.timezone" },
                { zone: garden.zoneLabel }
              )}
            </p>
            <div className="space-y-3">
              {events.slice(0, limit).map((record, index, shown) => {
                const heading = dayOf(record);
                const status = statusAt(record, dataset.reference);
                return (
                  <Fragment key={record.id}>
                    {index === 0 || dayOf(shown[index - 1]) !== heading ? (
                      <h3 className="type-label-sm font-medium text-text-sub">
                        {formatDay(heading, locale, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h3>
                    ) : null}
                    <ItemRow
                      title={recordTitle(garden, record)}
                      selected={open?.openId === record.id && open.records.length === 1}
                      onOpen={() => onOpen(record)}
                      lead={{
                        kind: "photo",
                        src: media[record.media],
                        mark:
                          filter === "all"
                            ? formatMessage({ id: "app.garden.detail.activity.filter.work" })
                            : undefined,
                      }}
                      status={{ label: STATUS_COPY[status].label, tone: STATUS_COPY[status].tone }}
                      details={[
                        `${accountName(garden, record.accountId)} · ${formatMessage({ id: "app.garden.detail.activity.workSubmitted" })}`,
                        {
                          text: formatMoment(record.submittedAt, locale, garden.timeZone),
                          tone: "soft",
                          dateTime: new Date(record.submittedAt).toISOString(),
                        },
                      ]}
                    />
                  </Fragment>
                );
              })}
            </div>
            {events.length > limit ? (
              <Button
                type="button"
                emphasis="tertiary"
                size="sm"
                onClick={() => setLimit(limit + FEED_PAGE)}
                className="mt-3 w-full"
              >
                {formatMessage({ id: "app.common.showMore" })}
              </Button>
            ) : null}
          </>
        )}
      </AdminCardBody>
    </AdminCard>
  );
}

export function GardenActivityScene({ dataset, media, day, openId }: GardenActivitySceneProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { garden } = dataset;

  return (
    <GardenScene
      dataset={dataset}
      media={media}
      view="activity"
      opening={dayOpening(dataset, day, openId)}
    >
      {({ scope, setScope, open, openRecords, health, alerts, gardeners }) => (
        <GardenTabLayout
          main={
            <>
              {isDesktop ? null : <GardenAlertsCard alerts={alerts} />}
              <ActivityCalendar
                dataset={dataset}
                scope={scope}
                records={scopeRecords(dataset, scope)}
                onScopeChange={setScope}
                onOpenRecords={openRecords}
                variant="overview"
                currentDay={open?.day}
              />
              <PlaceActivity
                dataset={dataset}
                scope={scope}
                records={scopeRecords(dataset, scope)}
                onOpenRecords={openRecords}
              />
              <ActivityFeed
                dataset={dataset}
                media={media}
                open={open}
                onOpen={(record) =>
                  openRecords({
                    title: formatMessage({
                      id: "app.work.detail.reviewTitle",
                      defaultMessage: "Review Work",
                    }),
                    scopeLine: `${recordTitle(garden, record)}, from ${accountName(garden, record.accountId)}`,
                    records: [record],
                    at: dataset.reference,
                    openId: record.id,
                  })
                }
              />
            </>
          }
          rail={
            <>
              {isDesktop ? <GardenAlertsCard alerts={alerts} /> : null}
              <AdminCard density="none">
                <AdminCardHeader>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.keyMetrics" })}
                  </AdminCardTitle>
                </AdminCardHeader>
                <AdminCardBody className="space-y-2">
                  <GardenKeyMetrics dataset={dataset} health={health} gardeners={gardeners} />
                </AdminCardBody>
              </AdminCard>
            </>
          }
        />
      )}
    </GardenScene>
  );
}
