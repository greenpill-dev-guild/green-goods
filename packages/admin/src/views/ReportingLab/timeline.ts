/**
 * Garden reporting lab: the season timeline's items. A promise's state reads from its due
 * date and the day it was done; planned work (published sessions, promises) and recorded
 * delivery (work records) stay separate lanes.
 */
import { recordsInWeek, statusAt, type WeekRange } from "./aggregate";
import { addDays, type DayKey, dayKeyOf, daysBetween, weekStartOf } from "./dates";
import type { PromiseItem, ReportDataset, ReportingWindow, SeasonMilestone } from "./model";
import { referenceDay } from "./scope";

export type ItemTone = "success" | "warning" | "error" | "info" | "neutral";

export interface TimelineItem {
  id: string;
  kind: "window" | "promise" | "milestone";
  title: string;
  start: DayKey;
  end: DayKey;
  pill: { label: string; tone: ItemTone };
  source: ReportingWindow | PromiseItem | SeasonMilestone;
}

function promiseState(item: PromiseItem, today: DayKey) {
  if (item.doneOn) {
    return item.doneOn <= item.due
      ? { label: "Done", tone: "success" as const }
      : { label: "Done late", tone: "warning" as const };
  }
  return item.due < today
    ? { label: "Past due", tone: "error" as const }
    : { label: "Open", tone: "neutral" as const };
}

function windowState(window: ReportingWindow, today: DayKey) {
  if (window.start > today) return { label: "Planned", tone: "neutral" as const };
  return window.end < today
    ? { label: "Closed", tone: "neutral" as const }
    : { label: "Open", tone: "info" as const };
}

export function timelineItems(dataset: ReportDataset): TimelineItem[] {
  const { garden } = dataset;
  const today = referenceDay(dataset);
  return [
    ...garden.windows.map((window) => ({
      id: window.id,
      kind: "window" as const,
      title: window.name,
      start: window.start,
      end: window.end,
      pill: windowState(window, today),
      source: window,
    })),
    ...garden.promises.map((item) => ({
      id: item.id,
      kind: "promise" as const,
      title: item.title,
      start: item.due,
      end: item.due,
      pill: promiseState(item, today),
      source: item,
    })),
    ...garden.milestones.map((item) => ({
      id: item.id,
      kind: "milestone" as const,
      title: item.title,
      start: item.on,
      end: item.on,
      pill: item.proposed
        ? { label: "Proposed", tone: "info" as const }
        : { label: "Recorded", tone: "success" as const },
      source: item,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));
}

/** The span the timeline draws: every item, from its first Monday to its last Sunday. */
export function timelineSpan(items: readonly TimelineItem[], dataset: ReportDataset) {
  const starts = [dataset.garden.recordsBegin, ...items.map((item) => item.start)].sort();
  const ends = [referenceDay(dataset), ...items.map((item) => item.end)].sort();
  const start = weekStartOf(starts[0]);
  const end = addDays(weekStartOf(ends[ends.length - 1]), 6);
  return { start, end, days: daysBetween(start, end) + 1 };
}

export interface DeliveryWeek {
  week: WeekRange;
  planned: number;
  recorded: number;
  approved: number;
}

/** Planned and recorded work per week: planned actions on one side, everything else on the other. */
export function deliveryByWeek(
  dataset: ReportDataset,
  span: { start: DayKey; end: DayKey }
): DeliveryWeek[] {
  const plannedIds = new Set(dataset.garden.actions.filter((a) => a.planned).map((a) => a.id));
  const weeks: DeliveryWeek[] = [];
  for (let start = span.start; start <= span.end; start = addDays(start, 7)) {
    const week = { start, end: addDays(start, 6) };
    const inWeek = recordsInWeek(dataset.records, week, dataset);
    const recorded = inWeek.filter((record) => !plannedIds.has(record.actionId));
    weeks.push({
      week,
      planned: inWeek.length - recorded.length,
      recorded: recorded.length,
      approved: recorded.filter((record) => statusAt(record, dataset.reference) === "approved")
        .length,
    });
  }
  return weeks;
}

/** The approved work a promise links: its action, inside its window, up to its due date. */
export function linkedWork(dataset: ReportDataset, item: PromiseItem) {
  const window = dataset.garden.windows.find((w) => w.id === item.windowId);
  if (!item.actionId || !window) return [];
  return dataset.records.filter((record) => {
    const day = dayKeyOf(record.submittedAt, dataset.garden.timeZone);
    return record.actionId === item.actionId && day >= window.start && day <= item.due;
  });
}
