/**
 * Garden reporting lab, interface 1: the monthly activity calendar. It says which date a
 * day counts (submission or review) and which moment its statuses read at (today or the
 * month's end), and tells a day with nothing apart from a day the read never reached.
 */
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { buildCalendar, type CalendarDay } from "./aggregate";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { dayRecordsRequest } from "./dayRequest";
import { type DayKey, dayKeyOf, formatDay, formatMonth } from "./dates";
import { describeCounts } from "./labCopy";
import type { ReportDataset, WorkRecord } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import { availableMonths, type ReportScope, statusMoment, closingDay } from "./scope";
import { StatusIcon } from "./StatusMarks";

interface ActivityCalendarProps {
  dataset: ReportDataset;
  scope: ReportScope;
  /** The scope's records before the status filter: the calendar applies that itself. */
  records: readonly WorkRecord[];
  onScopeChange: (patch: Partial<ReportScope>) => void;
  onOpenRecords: (request: RecordsRequest) => void;
  onLoadOlder?: () => void;
  variant?: "overview" | "full";
  /** The day whose records are open beside the calendar. */
  currentDay?: DayKey;
}

function Legend() {
  const item = "inline-flex items-center gap-1";
  return (
    <ul
      aria-label="Calendar key"
      className="flex flex-wrap gap-x-4 gap-y-1 type-meta text-text-sub"
    >
      <li className={item}>
        <StatusIcon status="approved" /> Approved
      </li>
      <li className={item}>
        <StatusIcon status="pending" /> Pending
      </li>
      <li className={item}>
        <StatusIcon status="rejected" /> Rejected
      </li>
      <li className={item}>
        <StatusIcon status="unknown" /> Status unread
      </li>
      <li className={item}>
        <span aria-hidden className="tabular-nums text-text-soft">
          0
        </span>{" "}
        Nothing submitted
      </li>
      <li className={item}>
        <span
          aria-hidden
          className="h-3 w-4 rounded-(--admin-radius-xs) border border-dashed border-stroke-sub"
        />{" "}
        Not loaded
      </li>
    </ul>
  );
}

export function ActivityCalendar({
  dataset,
  scope,
  records,
  onScopeChange,
  onOpenRecords,
  onLoadOlder,
  variant = "full",
  currentDay,
}: ActivityCalendarProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const at = statusMoment(scope, dataset);
  const calendar = buildCalendar({
    dataset,
    records,
    month: scope.month,
    groupBy: scope.groupBy,
    at,
    status: scope.status,
  });
  const months = availableMonths(dataset);
  const index = months.indexOf(scope.month);
  const monthLabel = formatMonth(scope.month, locale);
  const byReview = scope.groupBy === "reviewed";
  const noun = byReview ? "decision" : "submission";
  const running = scope.month === months[months.length - 1];
  const asOf = formatDay(closingDay(at, dataset), locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const performed = calendar.monthRecords.filter((record) => record.performedOn).length;
  const late = calendar.monthRecords.filter(
    (record) => record.sentFromDeviceAt !== undefined
  ).length;
  const loadedFrom =
    dataset.loadedFrom === null ? null : dayKeyOf(dataset.loadedFrom, garden.timeZone);

  const openDay = (cell: CalendarDay) =>
    onOpenRecords(dayRecordsRequest(cell, dataset, scope, locale));

  let definition = `Each day counts work submitted that day, in garden time (${garden.zoneLabel}). Statuses are as of ${asOf}.`;
  if (byReview)
    definition =
      "Each day counts decisions made that day. Pending work has no review date, so it does not appear.";
  else if (scope.statusAsOf === "period-end" && !running) {
    definition = `Each day counts work submitted that day. Statuses are as they stood at the end of ${asOf}; later reviews are left out.`;
  }

  return (
    <AdminCard density="none" className="flex flex-col" data-component="ActivityCalendar">
      <AdminCardHeader className="flex-wrap gap-3">
        <div className="min-w-0">
          <AdminCardTitle as="h2">
            {variant === "overview" ? "Activity Calendar" : monthLabel}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            {describeCounts(calendar.monthCounts, locale, noun)} on {calendar.daysWithWork} days
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Previous Month"
            icon={<RiArrowLeftSLine aria-hidden />}
            emphasis="tertiary"
            size="sm"
            disabled={index <= 0}
            onClick={() => onScopeChange({ month: months[index - 1] })}
          />
          <span
            aria-live="polite"
            className="min-w-[8.5rem] text-center type-label font-medium text-text-strong"
          >
            {monthLabel}
          </span>
          <IconButton
            aria-label="Next Month"
            icon={<RiArrowRightSLine aria-hidden />}
            emphasis="tertiary"
            size="sm"
            disabled={index >= months.length - 1}
            onClick={() => onScopeChange({ month: months[index + 1] })}
          />
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div
            role="group"
            aria-labelledby="calendar-days-by"
            className="flex items-center gap-1.5"
          >
            <span id="calendar-days-by" className="type-label-sm text-text-sub">
              Days by
            </span>
            <AdminFilterChip
              label="Submission"
              selected={!byReview}
              onToggle={() => onScopeChange({ groupBy: "submitted" })}
            />
            <AdminFilterChip
              label="Review"
              selected={byReview}
              onToggle={() => onScopeChange({ groupBy: "reviewed" })}
            />
          </div>
          <div
            role="group"
            aria-labelledby="calendar-status-as-of"
            className="flex items-center gap-1.5"
          >
            <span id="calendar-status-as-of" className="type-label-sm text-text-sub">
              Status as of
            </span>
            <AdminFilterChip
              label="Today"
              selected={scope.statusAsOf === "reference" || byReview || running}
              disabled={byReview || running}
              onToggle={() => onScopeChange({ statusAsOf: "reference" })}
            />
            <AdminFilterChip
              label="Month End"
              selected={scope.statusAsOf === "period-end" && !byReview && !running}
              disabled={byReview || running}
              onToggle={() => onScopeChange({ statusAsOf: "period-end" })}
            />
          </div>
        </div>
        <p className="type-meta text-text-sub">
          {definition} Work-performed dates are recorded on {performed} of{" "}
          {calendar.monthRecords.length} records and do not move them.
          {late > 0 ? ` ${late} were sent late from a device.` : ""}
        </p>
        {calendar.hasUnreadDays && loadedFrom ? (
          <Alert
            variant="warning"
            title="Part of this month is not loaded"
            action={
              onLoadOlder ? (
                <Button type="button" emphasis="secondary" size="compact" onClick={onLoadOlder}>
                  Load Older
                </Button>
              ) : undefined
            }
          >
            The work list reads the newest 50 submissions first. Days before{" "}
            {formatDay(loadedFrom, locale, { month: "short", day: "numeric" })} are not counted yet,
            and that day only in part.
          </Alert>
        ) : null}
        <CalendarMonthGrid
          weeks={calendar.weeks}
          noun={noun}
          locale={locale}
          monthLabel={monthLabel}
          onOpenDay={openDay}
          currentDay={currentDay}
        />
        <Legend />
      </AdminCardBody>
    </AdminCard>
  );
}
