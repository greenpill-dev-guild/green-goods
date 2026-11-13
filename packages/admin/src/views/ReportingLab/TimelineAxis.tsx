/**
 * Garden reporting lab (proposed component): the season timeline's drawing. Windows,
 * promise deadlines, milestones, planned work and recorded delivery share one axis, with
 * the chosen month shaded and today marked. It is decoration beside the timeline's list,
 * which holds every item as an openable row, so it is hidden from assistive technology
 * and from containers narrower than 40rem.
 */
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { daysBetween, type DayKey, firstDayOf, formatDay, lastDayOf, type MonthKey } from "./dates";
import type { ReportDataset, ReportingWindow } from "./model";
import { referenceDay } from "./scope";
import { deliveryByWeek, type TimelineItem } from "./timeline";

interface TimelineAxisProps {
  dataset: ReportDataset;
  items: readonly TimelineItem[];
  span: { start: DayKey; end: DayKey; days: number };
  month: MonthKey;
  locale: string;
}

const MARK_TONE = {
  success: "bg-success-base",
  warning: "bg-warning-base",
  error: "bg-error-base",
  info: "bg-information-base",
  neutral: "bg-text-soft",
};

function Lane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="type-meta text-text-sub">{label}</span>
      <div className="relative h-8">{children}</div>
    </div>
  );
}

export function TimelineAxis({ dataset, items, span, month, locale }: TimelineAxisProps) {
  const pct = (day: DayKey) => `${(daysBetween(span.start, day) / span.days) * 100}%`;
  const width = (start: DayKey, end: DayKey) =>
    `${((daysBetween(start, end) + 1) / span.days) * 100}%`;
  const delivery = deliveryByWeek(dataset, span);
  const peak = Math.max(1, ...delivery.map((week) => Math.max(week.planned, week.recorded)));
  const months = Array.from(new Set(delivery.map((week) => week.week.start.slice(0, 7))));

  return (
    <div className="@container" data-component="TimelineAxis">
      <div aria-hidden className="relative hidden flex-col gap-2 @[40rem]:flex">
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(8.5rem+0.75rem)]">
          <span
            className="absolute inset-y-0 bg-bg-weak"
            style={{
              left: pct(firstDayOf(month)),
              width: width(firstDayOf(month), lastDayOf(month)),
            }}
          />
          <span
            className="absolute inset-y-0 w-px bg-text-sub"
            style={{ left: pct(referenceDay(dataset)) }}
          />
        </div>
        <Lane label="Month">
          {months.map((key) => (
            <span
              key={key}
              className="absolute top-2 type-meta-sm text-text-soft"
              style={{ left: pct(firstDayOf(key) < span.start ? span.start : firstDayOf(key)) }}
            >
              {formatDay(firstDayOf(key), locale, { month: "short" })}
            </span>
          ))}
        </Lane>
        <Lane label="Seasons and campaigns">
          {items
            .filter((item) => item.kind === "window")
            .map((item) => (
              <span
                key={item.id}
                title={item.title}
                className={cn(
                  "absolute top-1 h-6 truncate rounded-(--admin-radius-sm) border px-2 type-meta-sm leading-6",
                  (item.source as ReportingWindow).kind === "season"
                    ? "border-information-light bg-information-lighter text-information-dark"
                    : "border-feature-light bg-feature-lighter text-feature-dark"
                )}
                style={{ left: pct(item.start), width: width(item.start, item.end) }}
              >
                {item.title}
              </span>
            ))}
        </Lane>
        {(
          [
            ["Promise deadlines", "promise"],
            ["Milestones", "milestone"],
          ] as const
        ).map(([label, kind]) => (
          <Lane key={kind} label={label}>
            {items
              .filter((item) => item.kind === kind)
              .map((item) => (
                <span
                  key={item.id}
                  title={`${item.title}: ${item.pill.label}`}
                  className={cn(
                    "absolute top-2.5 h-3 w-3 -translate-x-1/2 rotate-45 rounded-(--admin-radius-xs) ring-2 ring-bg-white",
                    MARK_TONE[item.pill.tone]
                  )}
                  style={{ left: pct(item.start) }}
                />
              ))}
          </Lane>
        ))}
        {(
          [
            ["Planned work", "planned"],
            ["Recorded delivery", "recorded"],
          ] as const
        ).map(([label, key]) => (
          <Lane key={key} label={label}>
            {delivery.map((week) => {
              const value = week[key];
              return value === 0 ? null : (
                <span
                  key={week.week.start}
                  className={cn(
                    "absolute bottom-0 rounded-t-(--admin-radius-xs)",
                    key === "planned" ? "border border-stroke-sub bg-bg-white" : "bg-success-base"
                  )}
                  style={{
                    left: pct(week.week.start),
                    width: `calc(${width(week.week.start, week.week.end)} - 2px)`,
                    height: `${Math.max(12, (value / peak) * 100)}%`,
                  }}
                />
              );
            })}
          </Lane>
        ))}
      </div>
    </div>
  );
}
