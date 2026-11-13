/**
 * Garden reporting lab (proposed component): a month of days, each a button that opens
 * its records. The grid takes one tab stop and the arrow keys move by day and week (a
 * fixed seven-column grid, so date steps are the layout); Home and End go to the week's
 * ends. Below a 34rem container the month becomes an agenda, newest day first.
 */
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type KeyboardEvent, useRef, useState } from "react";
import { AdminListRow } from "@/components/AdminListRow";
import type { CalendarDay } from "./aggregate";
import { addDays, type DayKey, formatDay } from "./dates";
import { describeCounts, formatNumber } from "./labCopy";
import { StatusBar, StatusMarks } from "./StatusMarks";

interface CalendarMonthGridProps {
  weeks: CalendarDay[][];
  /** "submission" or "decision": what a day counts. */
  noun: string;
  locale: string;
  monthLabel: string;
  onOpenDay: (cell: CalendarDay) => void;
  /** The day whose records are open beside the grid: announced as current and ringed. */
  currentDay?: DayKey;
}

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

function opens(cell: CalendarDay) {
  return cell.inMonth && cell.state !== "future" && cell.state !== "before-records";
}

function dayLabel(cell: CalendarDay, noun: string, locale: string) {
  const date = formatDay(cell.day, locale, { weekday: "long", month: "long", day: "numeric" });
  if (cell.state === "future") return `${date}: still to come`;
  if (cell.state === "before-records") return `${date}: before this garden's records began`;
  if (cell.state === "not-loaded")
    return `${date}: not loaded yet, older than the records read so far`;
  const counts =
    cell.counts.total === 0 ? `no ${noun}s` : describeCounts(cell.counts, locale, noun);
  const partial =
    cell.state === "partial" ? ". Partly loaded: older records that day are not read" : "";
  const late = cell.lateUploads > 0 ? `. ${cell.lateUploads} sent late from a device` : "";
  return `${date}${cell.isToday ? ", today" : ""}: ${counts}${partial}${late}`;
}

function DayBody({
  cell,
  locale,
  maxTotal,
}: {
  cell: CalendarDay;
  locale: string;
  maxTotal: number;
}) {
  if (cell.state === "not-loaded")
    return <span className="type-meta-sm text-text-soft">Not loaded</span>;
  if (cell.state === "future" || cell.state === "before-records") return null;
  if (cell.counts.total === 0) return <span className="type-meta text-text-soft">0</span>;
  return (
    <>
      <span className="flex items-baseline gap-1">
        <span className="type-title-sm font-semibold tabular-nums text-text-strong">
          {formatNumber(cell.counts.total, locale)}
        </span>
        {cell.state === "partial" ? (
          <span className="type-meta-sm text-warning-dark">+ unread</span>
        ) : null}
      </span>
      <StatusMarks counts={cell.counts} locale={locale} className="type-meta-sm" />
      <StatusBar counts={cell.counts} scale={cell.counts.total / maxTotal} className="mt-auto" />
    </>
  );
}

/** The agenda's quiet lines: runs of days with nothing to open, said once. */
function agendaItems(weeks: CalendarDay[][]) {
  const days = weeks
    .flat()
    .filter((cell) => cell.inMonth && cell.state !== "future")
    .reverse();
  const items: Array<
    { kind: "day"; cell: CalendarDay } | { kind: "gap"; from: DayKey; to: DayKey; state: string }
  > = [];
  for (const cell of days) {
    const quiet = cell.records.length === 0 && cell.state !== "partial";
    const state = cell.state === "recorded" ? "zero" : cell.state;
    const last = items[items.length - 1];
    if (!quiet) items.push({ kind: "day", cell });
    else if (last?.kind === "gap" && last.state === state) last.from = cell.day;
    else items.push({ kind: "gap", from: cell.day, to: cell.day, state });
  }
  return items;
}

const GAP_COPY: Record<string, string> = {
  zero: "no submissions",
  "not-loaded": "not loaded",
  "before-records": "before records began",
};

export function CalendarMonthGrid({
  weeks,
  noun,
  locale,
  monthLabel,
  onOpenDay,
  currentDay,
}: CalendarMonthGridProps) {
  const buttons = useRef(new Map<DayKey, HTMLButtonElement>());
  const cells = weeks.flat();
  const openable = cells.filter(opens);
  const fallback =
    openable.find((cell) => cell.day === currentDay) ??
    openable.find((cell) => cell.isToday) ??
    openable.find((c) => c.records.length > 0) ??
    openable[0];
  const [focused, setFocused] = useState<DayKey | undefined>(fallback?.day);
  const focusDay = openable.some((cell) => cell.day === focused) ? focused : fallback?.day;
  const maxTotal = Math.max(1, ...cells.map((cell) => cell.counts.total));
  const short = (day: DayKey) => formatDay(day, locale, { month: "short", day: "numeric" });

  const move = (from: DayKey, step: number) => {
    for (let day = addDays(from, step); ; day = addDays(day, step)) {
      const cell = cells.find((item) => item.day === day);
      if (!cell || !cell.inMonth) return undefined;
      if (opens(cell)) return day;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = (event.target as HTMLElement).dataset.day;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: DayKey | undefined;
    if (STEP[event.key] !== undefined) next = move(from, STEP[event.key]);
    else if (event.key === "Home" || event.key === "End") {
      const week = weeks.find((row) => row.some((cell) => cell.day === from)) ?? [];
      const candidates = week.filter(opens);
      next = (event.key === "Home" ? candidates[0] : candidates[candidates.length - 1])?.day;
    }
    if (!next) return;
    event.preventDefault();
    setFocused(next);
    buttons.current.get(next)?.focus();
  };

  return (
    <div className="@container">
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex grid; focus lives on the day buttons */}
      <div
        role="grid"
        aria-label={`${monthLabel}, by day`}
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
              {formatDay(cell.day, locale, { weekday: "short" })}
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
                    current={cell.day === currentDay}
                    tabIndex={cell.day === focusDay ? 0 : -1}
                    disabled={!opens(cell)}
                    aria-label={dayLabel(cell, noun, locale)}
                    onFocus={() => setFocused(cell.day)}
                    onClick={() => onOpenDay(cell)}
                    className={cn(
                      "flex h-full min-h-[5.5rem] flex-col gap-1 p-2 disabled:cursor-default",
                      cell.records.length === 0 && "bg-transparent",
                      cell.state === "not-loaded" && "border-dashed border-stroke-sub",
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
                        <span className="type-meta-sm text-text-sub">Today</span>
                      ) : null}
                    </span>
                    <span aria-hidden className="flex flex-1 flex-col gap-1">
                      <DayBody cell={cell} locale={locale} maxTotal={maxTotal} />
                    </span>
                  </AdminListRow>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <ol
        aria-label={`${monthLabel}, newest day first`}
        className="flex flex-col gap-(--gg-list-gap) @[34rem]:hidden"
      >
        {agendaItems(weeks).map((item) =>
          item.kind === "gap" ? (
            <li key={`gap-${item.to}`} className="px-3 type-meta text-text-soft">
              {item.from === item.to ? short(item.to) : `${short(item.from)} to ${short(item.to)}`}:{" "}
              {GAP_COPY[item.state]}
            </li>
          ) : (
            <li key={item.cell.day}>
              <AdminListRow
                aria-label={dayLabel(item.cell, noun, locale)}
                current={item.cell.day === currentDay}
                onClick={() => onOpenDay(item.cell)}
                className="flex flex-col gap-1"
              >
                <span aria-hidden className="flex items-baseline justify-between gap-3">
                  <span className="type-label font-semibold text-text-strong">
                    {formatDay(item.cell.day, locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {item.cell.isToday ? " (today)" : ""}
                  </span>
                  <span className="type-title-sm font-semibold tabular-nums text-text-strong">
                    {formatNumber(item.cell.counts.total, locale)}
                  </span>
                </span>
                <span aria-hidden className="flex flex-col gap-1">
                  <StatusMarks counts={item.cell.counts} locale={locale} className="type-meta" />
                  <StatusBar counts={item.cell.counts} scale={item.cell.counts.total / maxTotal} />
                </span>
              </AdminListRow>
            </li>
          )
        )}
      </ol>
    </div>
  );
}
