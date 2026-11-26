/**
 * A month of days, each a button that opens its work. The grid takes one tab stop and the
 * arrow keys move by day and week (seven fixed columns, so date steps are the layout); Home
 * and End go to the week's ends. Below a 34rem container the month becomes a list of days,
 * newest first, so nothing depends on a grid too narrow to read. A day the read never reached
 * is a row of its own there too, so it opens its dialog and View in Work at every width.
 */
import {
  dateOfDay,
  type GardenWorkCalendar,
  type WorkCalendarDay,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type KeyboardEvent, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { AdminListRow } from "@/components/AdminListRow";
import { describeWorkCounts, StatusBar, StatusMarks } from "./WorkCalendarMarks";

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

function opens(cell: WorkCalendarDay) {
  return cell.inMonth && !cell.isFuture;
}

function dayAriaLabel(cell: WorkCalendarDay, intl: IntlShape) {
  const date = intl.formatDate(dateOfDay(cell.day), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (cell.isFuture) {
    return intl.formatMessage(
      { id: "hub.garden.calendar.day.future", defaultMessage: "{date}: still to come" },
      { date }
    );
  }
  const what =
    cell.coverage === "unread"
      ? intl.formatMessage({ id: "hub.garden.calendar.day.unread", defaultMessage: "not read" })
      : cell.counts.total === 0
        ? intl.formatMessage({
            id: "hub.garden.calendar.day.nothing",
            defaultMessage: "nothing submitted",
          })
        : describeWorkCounts(cell.counts, intl, cell.coverage === "partial");
  return cell.isToday
    ? intl.formatMessage(
        { id: "hub.garden.calendar.day.today", defaultMessage: "{date}, today: {what}" },
        { date, what }
      )
    : `${date}: ${what}`;
}

/**
 * Runs of days with no work are said once in the phone list, not once a day. A day a cut read
 * never reached stays a row of its own: only its own read can say what it holds.
 */
function agendaItems(weeks: WorkCalendarDay[][]) {
  const items: Array<
    { kind: "day"; cell: WorkCalendarDay } | { kind: "gap"; from: string; to: string }
  > = [];
  for (const cell of weeks.flat().filter(opens).reverse()) {
    const last = items[items.length - 1];
    if (cell.works.length > 0 || cell.coverage === "unread") items.push({ kind: "day", cell });
    else if (last?.kind === "gap") last.from = cell.day;
    else items.push({ kind: "gap", from: cell.day, to: cell.day });
  }
  return items;
}

/** A day's total, with "+" where it is only a minimum. */
function dayTotal(cell: WorkCalendarDay, intl: IntlShape) {
  const total = intl.formatNumber(cell.counts.total);
  return cell.coverage === "partial"
    ? intl.formatMessage(
        { id: "hub.garden.calendar.day.atLeastCount", defaultMessage: "{count}+" },
        { count: total }
      )
    : total;
}

export function WorkCalendarGrid({
  calendar,
  monthLabel,
}: {
  calendar: GardenWorkCalendar;
  monthLabel: string;
}) {
  const intl = useIntl();
  const { weeks, openDay, handleOpenDay } = calendar;
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const cells = weeks.flat();
  const openable = cells.filter(opens);
  const fallback =
    openable.find((cell) => cell.day === openDay?.day) ??
    openable.find((cell) => cell.isToday) ??
    openable.find((cell) => cell.works.length > 0) ??
    openable[0];
  const [focused, setFocused] = useState<string | undefined>(fallback?.day);
  const focusDay = openable.some((cell) => cell.day === focused) ? focused : fallback?.day;
  const maxTotal = Math.max(1, ...cells.map((cell) => cell.counts.total));
  const short = (day: string) =>
    intl.formatDate(dateOfDay(day), { month: "short", day: "numeric" });
  const todayLabel = intl.formatMessage({
    id: "hub.garden.calendar.today",
    defaultMessage: "Today",
  });
  const notReadLabel = intl.formatMessage({
    id: "hub.garden.calendar.day.unreadShort",
    defaultMessage: "Not read",
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = (event.target as HTMLElement).dataset.day;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = openable.findIndex((cell) => cell.day === from);
    if (index < 0) return;
    let next: WorkCalendarDay | undefined;
    if (STEP[event.key] !== undefined) next = openable[index + STEP[event.key]];
    else if (event.key === "Home" || event.key === "End") {
      const week = (weeks.find((row) => row.some((cell) => cell.day === from)) ?? []).filter(opens);
      next = event.key === "Home" ? week[0] : week[week.length - 1];
    }
    if (!next) return;
    event.preventDefault();
    setFocused(next.day);
    buttons.current.get(next.day)?.focus();
  };

  return (
    <div className="@container">
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex grid; focus lives on the day buttons */}
      <div
        role="grid"
        aria-label={intl.formatMessage(
          { id: "hub.garden.calendar.gridLabel", defaultMessage: "{month}, by day" },
          { month: monthLabel }
        )}
        onKeyDown={onKeyDown}
        className="hidden flex-col gap-1.5 @[34rem]:flex"
      >
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {weeks[0].map((cell) => (
            <span
              key={cell.day}
              role="columnheader"
              className="px-1 type-meta-sm font-medium text-text-soft"
            >
              {intl.formatDate(dateOfDay(cell.day), { weekday: "short" })}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].day} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map((cell) => (
              <div key={cell.day} role="gridcell" className="min-w-0">
                {cell.inMonth ? (
                  <AdminListRow
                    ref={(node) => {
                      if (node) buttons.current.set(cell.day, node);
                      else buttons.current.delete(cell.day);
                    }}
                    data-day={cell.day}
                    current={cell.day === openDay?.day}
                    tabIndex={cell.day === focusDay ? 0 : -1}
                    disabled={!opens(cell)}
                    aria-label={dayAriaLabel(cell, intl)}
                    onFocus={() => setFocused(cell.day)}
                    onClick={() => handleOpenDay(cell.day)}
                    className={cn(
                      "flex h-full min-h-[5.5rem] flex-col gap-1 p-2 disabled:cursor-default",
                      cell.works.length === 0 && "bg-transparent",
                      !opens(cell) && "border-transparent",
                      cell.isToday && "border-stroke-sub"
                    )}
                  >
                    <span aria-hidden className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "type-label-sm font-semibold tabular-nums",
                          opens(cell) ? "text-text-strong" : "text-text-disabled"
                        )}
                      >
                        {Number(cell.day.slice(8))}
                      </span>
                      {cell.isToday ? (
                        <span className="type-meta-sm text-text-sub">{todayLabel}</span>
                      ) : null}
                    </span>
                    {opens(cell) ? (
                      <span aria-hidden className="flex flex-1 flex-col gap-1">
                        {/* A day a cut read never reached is not read, never a 0. */}
                        {cell.coverage === "unread" ? (
                          <span className="type-meta text-text-soft">{notReadLabel}</span>
                        ) : cell.counts.total === 0 ? (
                          <span className="type-meta text-text-soft">0</span>
                        ) : (
                          <>
                            <span className="type-title-sm font-semibold tabular-nums text-text-strong">
                              {dayTotal(cell, intl)}
                            </span>
                            <StatusMarks counts={cell.counts} className="type-meta-sm" />
                            <StatusBar
                              counts={cell.counts}
                              scale={cell.counts.total / maxTotal}
                              className="mt-auto"
                            />
                          </>
                        )}
                      </span>
                    ) : null}
                  </AdminListRow>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <ol
        aria-label={intl.formatMessage(
          {
            id: "hub.garden.calendar.agendaLabel",
            defaultMessage: "{month}, newest day first",
          },
          { month: monthLabel }
        )}
        className="flex flex-col gap-(--gg-list-gap) @[34rem]:hidden"
      >
        {agendaItems(weeks).map((item) =>
          item.kind === "gap" ? (
            <li key={`gap-${item.to}`} className="px-3 type-meta text-text-soft">
              {intl.formatMessage(
                { id: "hub.garden.calendar.gap", defaultMessage: "{range}: nothing submitted" },
                {
                  range:
                    item.from === item.to
                      ? short(item.to)
                      : intl.formatMessage(
                          {
                            id: "hub.garden.calendar.gapRange",
                            defaultMessage: "{from} to {to}",
                          },
                          { from: short(item.from), to: short(item.to) }
                        ),
                }
              )}
            </li>
          ) : (
            <li key={item.cell.day}>
              <AdminListRow
                aria-label={dayAriaLabel(item.cell, intl)}
                current={item.cell.day === openDay?.day}
                onClick={() => handleOpenDay(item.cell.day)}
                className="flex flex-col gap-1"
              >
                <span aria-hidden className="flex items-baseline justify-between gap-3">
                  <span className="type-label font-semibold text-text-strong">
                    {intl.formatDate(dateOfDay(item.cell.day), {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {item.cell.isToday ? ` (${todayLabel})` : ""}
                  </span>
                  {/* A day a cut read never reached is not read, never a 0. */}
                  {item.cell.coverage === "unread" ? (
                    <span className="type-meta text-text-soft">{notReadLabel}</span>
                  ) : (
                    <span className="type-title-sm font-semibold tabular-nums text-text-strong">
                      {dayTotal(item.cell, intl)}
                    </span>
                  )}
                </span>
                {item.cell.coverage === "unread" ? null : (
                  <span aria-hidden className="flex flex-col gap-1">
                    <StatusMarks counts={item.cell.counts} className="type-meta" />
                    <StatusBar
                      counts={item.cell.counts}
                      scale={item.cell.counts.total / maxTotal}
                    />
                  </span>
                )}
              </AdminListRow>
            </li>
          )
        )}
      </ol>
    </div>
  );
}
