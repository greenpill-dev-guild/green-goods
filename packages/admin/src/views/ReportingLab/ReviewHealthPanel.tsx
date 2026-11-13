/**
 * Garden reporting lab, interface 2: review health. Age is metadata (DL-044): the bands
 * read in plain ink, and only the shipped stall rule turns the status red. Choosing a
 * band narrows the waiting list beside it.
 */
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { DAY_IN_MS, dayKeyOf, formatDay, formatShortDay } from "./dates";
import { accountName, formatDays, formatNumber, recordTitle, weekTicks } from "./labCopy";
import type { MediaSet, ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import { type AgeBandId, reviewHealth } from "./reviewHealth";
import { periodEnd, type ReportScope, closingDay } from "./scope";
import { WeeklyBars } from "./WeeklyBars";

interface ReviewHealthPanelProps {
  dataset: ReportDataset;
  scope: ReportScope;
  records: readonly WorkRecord[];
  media: MediaSet;
  onOpenRecords: (request: RecordsRequest) => void;
  onOpenReport?: () => void;
  /** In the summary, a band hands off here (to the Hub's Work chips) instead of opening a list. */
  onOpenBand?: (band: AgeBandId) => void;
  variant?: "summary" | "full";
}

export function ReviewHealthPanel({
  dataset,
  scope,
  records,
  media,
  onOpenRecords,
  onOpenReport,
  onOpenBand,
  variant = "full",
}: ReviewHealthPanelProps) {
  const { locale } = useIntl();
  const [band, setBand] = useState<AgeBandId | null>(null);
  const { garden } = dataset;
  const at = periodEnd(scope.month, dataset);
  const health = reviewHealth(dataset, records, at, scope.month);
  const asOf = formatDay(closingDay(at, dataset), locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const overWeek = health.bands
    .filter((b) => b.id === "1-2w" || b.id === "over-2w")
    .reduce((n, b) => n + b.records.length, 0);
  const oldest = health.pending[0];
  const summary = variant === "summary";
  const listed = band ? (health.bands.find((b) => b.id === band)?.records ?? []) : health.pending;

  const waitingRow = (record: WorkRecord) => (
    <li key={record.id}>
      <ItemRow
        lead={{ kind: "photo", src: media[record.media] }}
        title={recordTitle(garden, record)}
        status={{ label: "Pending", tone: "warning" }}
        edge="warning"
        details={[
          accountName(garden, record.accountId),
          {
            text: `waiting ${formatDays((at - record.submittedAt) / DAY_IN_MS, locale)}`,
            tone: "soft",
          },
        ]}
        onOpen={() =>
          onOpenRecords({
            title: "Waiting for Review",
            scopeLine: `Pending as of ${asOf}`,
            records: health.pending,
            at,
            openId: record.id,
          })
        }
      />
    </li>
  );

  return (
    <AdminCard density="none" className="flex flex-col" data-component="ReviewHealthPanel">
      <AdminCardHeader className="flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <AdminCardTitle as="h2">{summary ? "Review Health" : `As of ${asOf}`}</AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">{health.detail}</p>
        </div>
        <StatusBadge variant={health.tone}>{health.label}</StatusBadge>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-4">
        <div
          className={summary ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-4 sm:grid-cols-4"}
        >
          <StatTile label="Waiting" value={formatNumber(health.pending.length, locale)} />
          <StatTile label="Over a week" value={formatNumber(overWeek, locale)} />
          {summary ? null : (
            <StatTile
              label="Oldest waiting"
              value={oldest ? formatDays((at - oldest.submittedAt) / DAY_IN_MS, locale) : "None"}
              delta={
                oldest
                  ? `since ${formatShortDay(dayKeyOf(oldest.submittedAt, garden.timeZone), locale)}`
                  : undefined
              }
            />
          )}
          <StatTile
            label="Median review time"
            value={health.medianDays === null ? "Unknown" : formatDays(health.medianDays, locale)}
            delta={summary ? undefined : "submission to decision"}
          />
        </div>

        <div role="group" aria-label="Waiting work by age" className="flex flex-wrap gap-1.5">
          {health.bands.map((item) =>
            summary ? (
              <Button
                key={item.id}
                type="button"
                emphasis="secondary"
                size="compact"
                disabled={item.records.length === 0}
                onClick={() =>
                  onOpenBand
                    ? onOpenBand(item.id)
                    : onOpenRecords({
                        title: `Waiting ${item.label}`,
                        scopeLine: `Pending as of ${asOf}`,
                        records: item.records,
                        at,
                      })
                }
              >
                {item.label}: {item.records.length}
              </Button>
            ) : (
              <AdminFilterChip
                key={item.id}
                label={`${item.label}: ${item.records.length}`}
                selected={band === item.id}
                onToggle={() => setBand(band === item.id ? null : item.id)}
              />
            )
          )}
        </div>

        {health.pending.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="type-label font-semibold text-text-strong">
              {summary
                ? "Oldest Waiting"
                : band
                  ? `Waiting ${health.bands.find((b) => b.id === band)?.label.toLowerCase()}`
                  : "All Waiting, Oldest First"}
            </h3>
            <ul className="flex flex-col gap-(--gg-list-gap)">
              {(summary ? health.oldest.slice(0, 2) : listed.slice(0, 8)).map(waitingRow)}
            </ul>
            {!summary && listed.length > 8 ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="compact"
                  onClick={() =>
                    onOpenRecords({
                      title: "Waiting for Review",
                      scopeLine: `Pending as of ${asOf}`,
                      records: listed,
                      at,
                    })
                  }
                >
                  See All {listed.length}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {summary ? null : (
          <WeeklyBars
            title="Submitted and Reviewed, by Week"
            mode="paired"
            primaryLabel="Submitted"
            secondaryLabel="Reviewed"
            points={health.flow.map((week, index) => ({
              key: week.week.start,
              ...weekTicks(
                health.flow.map((item) => item.week.start),
                locale
              )[index],
              fullLabel: `Week of ${formatShortDay(week.week.start, locale)}`,
              primary: week.submitted,
              secondary: week.reviewed,
              running: week.week.end >= closingDay(at, dataset),
            }))}
            format={(value) => formatNumber(value, locale)}
            note={`Waiting at each week's end: ${health.flow.map((week) => week.waiting).join(", ")}.`}
          />
        )}
        {health.unknown > 0 ? (
          <p className="type-meta text-text-sub">
            {`The review status of ${health.unknown} records could not be read; they are left out of these counts.`}
          </p>
        ) : null}
        {summary && onOpenReport ? (
          <div className="flex justify-end">
            <Button type="button" emphasis="tertiary" size="compact" onClick={onOpenReport}>
              Open Review Health
            </Button>
          </div>
        ) : null}
      </AdminCardBody>
    </AdminCard>
  );
}
