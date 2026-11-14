/**
 * Garden reporting lab, interface 3: output trends. One small chart per measure, so kilos,
 * sessions and hours never share an axis, each drawing what was reported with the approved
 * part inside it. A week opens its records. The month line under each chart counts the
 * same records as the calendar, so the two agree.
 */
import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { measureSeries, reportWeeks } from "./aggregate";
import { actionBreakdown } from "./breakdowns";
import {
  dayKeyOf,
  firstDayOf,
  formatDay,
  formatMonth,
  formatShortDay,
  lastDayOf,
  monthOf,
} from "./dates";
import { filterSummary, formatNumber, formatQuantity, weekTicks } from "./labCopy";
import type { MeasureDef, ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import { referenceDay, type ReportScope } from "./scope";
import { StatusMarks } from "./StatusMarks";
import { WeeklyBars } from "./WeeklyBars";

interface OutputTrendsProps {
  dataset: ReportDataset;
  scope: ReportScope;
  records: readonly WorkRecord[];
  onOpenRecords: (request: RecordsRequest) => void;
  onOpenReport?: () => void;
  variant?: "summary" | "full";
}

const GAP_COPY = { "before-records": "Before records", "not-loaded": "Not loaded" } as const;

export function OutputTrends({
  dataset,
  scope,
  records,
  onOpenRecords,
  onOpenReport,
  variant = "full",
}: OutputTrendsProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const weeks = reportWeeks(scope.month, dataset);
  const ticks = weekTicks(
    weeks.map((week) => week.start),
    locale
  );
  const monthRecords = records.filter(
    (r) => monthOf(dayKeyOf(r.submittedAt, garden.timeZone)) === scope.month
  );
  const monthLabel = formatMonth(scope.month, locale);
  const measures = variant === "summary" ? garden.measures.slice(0, 3) : garden.measures;

  const monthLine = (measure: MeasureDef) => {
    const range = { start: firstDayOf(scope.month), end: lastDayOf(scope.month) };
    const [month] = measureSeries(dataset, monthRecords, measure, [range]);
    const missing = month.missing > 0 ? ` ${month.missing} left it empty and are not counted.` : "";
    return `${monthLabel}: ${formatQuantity(month.reported, measure.unit, locale)} reported, ${formatQuantity(month.approved, measure.unit, locale)} approved, from ${month.records.length} records.${missing}`;
  };

  const chart = (measure: MeasureDef) => {
    const series = measureSeries(dataset, records, measure, weeks);
    return (
      <WeeklyBars
        key={measure.id}
        title={`${measure.label} (${measure.unit})`}
        primaryLabel="Reported"
        secondaryLabel="Approved"
        compact={variant === "summary"}
        points={series.map((point, index) => ({
          key: point.week.start,
          ...ticks[index],
          fullLabel: `Week of ${formatShortDay(point.week.start, locale)}`,
          primary: point.reported,
          secondary: point.approved,
          gap:
            point.state === "before-records" || point.state === "not-loaded"
              ? GAP_COPY[point.state]
              : undefined,
          running: point.state === "in-progress",
        }))}
        format={(value) => formatNumber(value, locale, measure.kind === "hours" ? 1 : 0)}
        onSelect={(index) => {
          const point = series[index];
          onOpenRecords({
            title: `${measure.label}, Week of ${formatDay(point.week.start, locale, { month: "short", day: "numeric" })}`,
            scopeLine: `Submitted ${formatShortDay(point.week.start, locale)} to ${formatShortDay(point.week.end, locale)}, ${filterSummary(scope, garden)}`,
            records: point.records,
            at: dataset.reference,
          });
        }}
        summary={monthLine(measure)}
        note={measure.note}
      />
    );
  };

  const rows = actionBreakdown(dataset, monthRecords);

  return (
    <AdminCard density="none" className="flex flex-col" data-component="OutputTrends">
      <AdminCardHeader className="flex-wrap gap-3">
        <div className="min-w-0">
          <AdminCardTitle as="h2">
            {variant === "summary" ? "Output Trends" : "Weekly Outputs"}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            Eight weeks from {formatShortDay(weeks[0].start, locale)}
            {weeks[weeks.length - 1].end >= referenceDay(dataset)
              ? `; the week of ${formatShortDay(weeks[weeks.length - 1].start, locale)} is still running`
              : ""}
            . Each unit has its own chart, and approval is as of today. Choose a week to see its
            records.
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {measures.map(chart)}
        </div>
        {variant === "full" ? (
          <div className="flex flex-col gap-2">
            <h3 className="type-label font-semibold text-text-strong">{monthLabel} by Action</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] type-body">
                <caption className="sr-only">
                  {monthLabel}: records and quantities by action
                </caption>
                <thead>
                  <tr className="border-b border-stroke-soft text-left type-label-sm text-text-sub">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Action
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Records
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Reported
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Approved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.action.id} className="border-b border-stroke-soft last:border-0">
                      <th
                        scope="row"
                        className="max-w-[16rem] truncate py-2 pr-3 text-left font-medium text-text-strong"
                        title={row.action.title}
                      >
                        {row.action.title}
                      </th>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(row.counts.total, locale)}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusMarks counts={row.counts} locale={locale} className="type-meta" />
                      </td>
                      {row.measure ? (
                        <>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatQuantity(row.reported, row.measure.unit, locale)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatQuantity(row.approved, row.measure.unit, locale)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} className="py-2 text-right type-meta text-text-soft">
                          {row.unitNote ? `Not summed. ${row.unitNote}` : "No quantity recorded"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="type-meta text-text-soft">
              Rejected records stay in Reported and leave Approved. Sorting, transfer and batch
              weights can describe the same material, so they are never added together.
            </p>
          </div>
        ) : null}
        {variant === "summary" && onOpenReport ? (
          <div className="flex justify-end">
            <Button type="button" emphasis="tertiary" size="compact" onClick={onOpenReport}>
              Open Output Trends
            </Button>
          </div>
        ) : null}
      </AdminCardBody>
    </AdminCard>
  );
}
