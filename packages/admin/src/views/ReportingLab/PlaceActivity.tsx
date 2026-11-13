/**
 * Garden reporting lab, interface 5: place-based activity. The repository has no map
 * library, so the map is schematic: named sites placed by their approximate offsets, not
 * to scale, with no tiles. The site list beside it is the working control and the fallback,
 * and it keeps the records with no location in view.
 */
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminListRow } from "@/components/AdminListRow";
import { matchesStatus, type StatusCounts } from "./aggregate";
import { placeSummary } from "./breakdowns";
import { dayKeyOf, formatMonth, monthOf } from "./dates";
import { describeCounts, filterSummary, formatNumber } from "./labCopy";
import type { ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import type { ReportScope } from "./scope";
import { StatusBar, StatusMarks } from "./StatusMarks";

interface PlaceActivityProps {
  dataset: ReportDataset;
  scope: ReportScope;
  records: readonly WorkRecord[];
  onOpenRecords: (request: RecordsRequest) => void;
}

const PAD = 400;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function PlaceActivity({ dataset, scope, records, onOpenRecords }: PlaceActivityProps) {
  const { locale } = useIntl();
  const [highlight, setHighlight] = useState<string | null>(null);
  const { garden } = dataset;
  const monthLabel = formatMonth(scope.month, locale);
  const inMonth = records.filter(
    (r) =>
      monthOf(dayKeyOf(r.submittedAt, garden.timeZone)) === scope.month &&
      matchesStatus(r, dataset.reference, scope.status)
  );
  const summary = placeSummary(dataset, inMonth, dataset.reference);
  const max = Math.max(1, ...summary.sites.map((row) => row.records.length));
  const east = garden.sites.map((s) => s.east);
  const north = garden.sites.map((s) => s.north);
  const box = {
    x: Math.min(...east, 0) - PAD,
    y: -(Math.max(...north, 0) + PAD),
    w: Math.max(...east, 0) - Math.min(...east, 0) + PAD * 2,
    h: Math.max(...north, 0) - Math.min(...north, 0) + PAD * 2,
  };
  const share = summary.total === 0 ? 0 : Math.round((summary.located / summary.total) * 100);
  const open = (title: string, list: WorkRecord[]) =>
    onOpenRecords({
      title,
      scopeLine: `${monthLabel}, ${filterSummary(scope, garden)}`,
      records: list,
      at: dataset.reference,
    });

  const row = (
    key: string,
    name: string,
    list: WorkRecord[],
    counts: StatusCounts,
    letter?: string,
    note?: string
  ) => (
    <li key={key}>
      <AdminListRow
        current={highlight === key}
        onMouseEnter={() => setHighlight(key)}
        onFocus={() => setHighlight(key)}
        onClick={() => open(name, list)}
        aria-label={`${name}: ${describeCounts(counts, locale, "record")}. Open records`}
        className="flex flex-col gap-1"
      >
        <span aria-hidden className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-(--admin-radius-full) border border-stroke-sub type-meta-sm font-semibold text-text-sub">
              {letter ?? "–"}
            </span>
            <span className="truncate type-label font-semibold text-text-strong" title={name}>
              {name}
            </span>
          </span>
          <span className="type-title-sm font-semibold tabular-nums text-text-strong">
            {formatNumber(list.length, locale)}
          </span>
        </span>
        <span aria-hidden className="flex flex-col gap-1">
          {note ? (
            <span className="type-meta text-text-sub">{note}</span>
          ) : (
            <StatusMarks counts={counts} locale={locale} className="type-meta" />
          )}
          <StatusBar
            counts={counts}
            scale={list.length / Math.max(max, summary.unlocated.records.length)}
          />
        </span>
      </AdminListRow>
    </li>
  );

  return (
    <AdminCard density="none" data-component="PlaceActivity">
      <AdminCardHeader className="flex-wrap gap-3">
        <div className="min-w-0">
          <AdminCardTitle as="h2">{monthLabel}</AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            Work shares a location only when the gardener allows it, and only roughly. Named sites
            are a proposal: today a record holds coarse coordinates and nothing more.
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile
            label="With a location"
            value={`${share}%`}
            delta={`${summary.located} of ${summary.total} records`}
          />
          <StatTile
            label="No location"
            value={formatNumber(summary.unlocated.records.length, locale)}
            delta="listed below the sites"
          />
        </div>
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @[44rem]:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
            <figure className="flex flex-col gap-1">
              <svg
                role="img"
                aria-label={`Schematic map of ${summary.sites.length} sites: ${summary.sites.map((s) => `${s.site.name}, ${s.records.length} records`).join("; ")}`}
                viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
                className="aspect-[4/3] w-full rounded-(--admin-radius-lg) border border-stroke-soft bg-bg-weak"
              >
                {summary.sites.map(({ site, records: own }, index) => {
                  const radius = 70 + 230 * Math.sqrt(own.length / max);
                  const lit = highlight === site.id;
                  return (
                    <g key={site.id} transform={`translate(${site.east} ${-site.north})`}>
                      <circle
                        r={radius}
                        className={cn(
                          "fill-information-base/25 stroke-information-dark",
                          lit ? "stroke-[24]" : "stroke-[6]"
                        )}
                      />
                      <g transform={`translate(${-radius * 0.72} ${-radius * 0.72})`}>
                        <circle r={70} className="fill-bg-white stroke-stroke-sub stroke-[6]" />
                        <text
                          y={32}
                          textAnchor="middle"
                          className="fill-text-sub font-semibold"
                          style={{ fontSize: 90 }}
                        >
                          {LETTERS[index]}
                        </text>
                      </g>
                      <text
                        y={45}
                        textAnchor="middle"
                        className="fill-text-strong font-semibold"
                        style={{ fontSize: 130 }}
                      >
                        {own.length}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <figcaption className="type-meta text-text-soft">
                Schematic, not to scale; north is up. Each letter matches a site in the list, and
                circles grow with the records there.
              </figcaption>
            </figure>
            <ul aria-label="Sites" className="flex flex-col gap-(--gg-list-gap)">
              {summary.sites.map(({ site, records: own, counts }, index) =>
                row(site.id, site.name, own, counts, LETTERS[index])
              )}
              {row(
                "none",
                "No location",
                summary.unlocated.records,
                summary.unlocated.counts,
                undefined,
                "Not on the map: no location was shared."
              )}
            </ul>
          </div>
        </div>
      </AdminCardBody>
    </AdminCard>
  );
}
