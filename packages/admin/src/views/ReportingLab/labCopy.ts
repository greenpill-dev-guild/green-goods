/**
 * Garden reporting lab: prototype copy and small formatters. The copy is English-only
 * prototype text; production strings would go through the en/es/pt catalogs.
 */
import type { StatusCounts } from "./aggregate";
import { type DayKey, formatDay } from "./dates";
import type { ReportGarden, StatusView, WorkRecord } from "./model";
import { type ReportScope, type ReportView, VIEW_FILTERS } from "./scope";

export interface ViewCopy {
  title: string;
  /** The steward question the report answers. */
  question: string;
}

export const VIEW_COPY: Record<ReportView, ViewCopy> = {
  overview: {
    title: "Reports",
    question: "What happened, how review is keeping up, and what the work produced.",
  },
  calendar: { title: "Activity Calendar", question: "What happened on each day of the month?" },
  review: { title: "Review Health", question: "Is review keeping up with the work coming in?" },
  outputs: { title: "Output Trends", question: "What did the work produce, week by week?" },
  season: {
    title: "Season Timeline",
    question: "Are the season's promises and milestones on track?",
  },
  places: { title: "Places", question: "Where did the work happen?" },
  people: { title: "Participation", question: "Who is taking part, and who has gone quiet?" },
  funding: { title: "Funding History", question: "What came in, what went out, and what is held?" },
  evidence: {
    title: "Evidence and Outcomes",
    question: "What changed since the baseline, and what shows it?",
  },
};

export const REPORT_ORDER: readonly ReportView[] = [
  "overview",
  "calendar",
  "review",
  "outputs",
  "season",
  "places",
  "people",
  "funding",
  "evidence",
];

export const STATUS_COPY: Record<
  StatusView,
  { label: string; tone: "success" | "warning" | "error" | "neutral" }
> = {
  approved: { label: "Approved", tone: "success" },
  pending: { label: "Pending", tone: "neutral" },
  rejected: { label: "Rejected", tone: "error" },
  unknown: { label: "Status unread", tone: "neutral" },
};

export function formatNumber(value: number, locale: string, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** A quantity with its unit, never a bare number: "2,410 kg", "38.5 hours". */
export function formatQuantity(value: number, unit: string, locale: string) {
  return `${formatNumber(value, locale, unit === "hours" ? 1 : 0)} ${unit}`;
}

export function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** "14 submissions: 9 approved, 3 pending, 2 rejected", leaving out the zeros. */
export function describeCounts(counts: StatusCounts, locale: string, noun = "submission") {
  const head = `${formatNumber(counts.total, locale)} ${plural(counts.total, noun, `${noun}s`)}`;
  const parts = (["approved", "pending", "rejected", "unknown"] as const)
    .filter((status) => counts[status] > 0)
    .map(
      (status) =>
        `${formatNumber(counts[status], locale)} ${STATUS_COPY[status].label.toLowerCase()}`
    );
  return parts.length > 0 ? `${head}: ${parts.join(", ")}` : head;
}

export function accountName(garden: ReportGarden, id: string) {
  return (
    garden.accounts.find((account) => account.id === id)?.name ??
    garden.team.find((account) => account.id === id)?.name ??
    id
  );
}

export function actionTitle(garden: ReportGarden, id: string, short = false) {
  const action = garden.actions.find((item) => item.id === id);
  if (!action) return id;
  return short ? action.shortTitle : action.title;
}

/** Axis ticks for week starts: the day on top, the month under the week where it changes. */
export function weekTicks(starts: readonly DayKey[], locale: string) {
  return starts.map((start, index) => ({
    label: String(Number(start.slice(8))),
    group:
      index === 0 || start.slice(0, 7) !== starts[index - 1].slice(0, 7)
        ? formatDay(start, locale, { month: "short" })
        : undefined,
  }));
}

/** A work row's title: the action first, unless the work's own title already names it. */
export function recordTitle(garden: ReportGarden, record: WorkRecord) {
  const action = actionTitle(garden, record.actionId, true);
  return record.title.toLowerCase().includes(action.toLowerCase())
    ? record.title
    : `${action}: ${record.title}`;
}

/** The filters a list was read under, for its dialog's scope line. */
export function filterSummary(scope: ReportScope, garden: ReportGarden) {
  const filters = VIEW_FILTERS[scope.view];
  const parts: string[] = [];
  if (filters.action && scope.actionId !== "all") parts.push(actionTitle(garden, scope.actionId));
  const window = garden.windows.find((item) => item.id === scope.windowId);
  if (filters.window && window) parts.push(window.name);
  if (filters.status && scope.status !== "all")
    parts.push(`${STATUS_COPY[scope.status].label} only`);
  return parts.length > 0 ? parts.join(", ") : "All actions";
}

export function formatDays(days: number, locale: string) {
  if (days < 1) return `${formatNumber(Math.max(days * 24, 1), locale)} hours`;
  const shown = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${formatNumber(shown, locale, 1)} ${plural(shown, "day", "days")}`;
}
