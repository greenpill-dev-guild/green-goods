/**
 * How the Activity calendar says a set of submissions' statuses: icon-and-number marks, a
 * proportion bar beside them, and one sentence for a screen reader. Status never rests on
 * color: each mark carries its glyph, and the bar is decoration.
 */
import type {
  WorkCalendarStatus,
  WorkStatusCounts,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiCheckLine,
  RiCloseLine,
  RiQuestionMark,
  RiTimeLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";

const STATUS_ORDER: readonly WorkCalendarStatus[] = ["approved", "pending", "rejected", "unknown"];

// Pending is neutral, as Review's cards say it: waiting is information, never an alarm
// (DL-044). Its clock tells it from a status that could not be read.
const STATUS_MARK: Record<
  WorkCalendarStatus,
  { icon: RemixiconComponentType; ink: string; fill: string }
> = {
  approved: { icon: RiCheckLine, ink: "text-success-dark", fill: "bg-success-base" },
  pending: { icon: RiTimeLine, ink: "text-text-sub", fill: "bg-text-soft" },
  rejected: { icon: RiCloseLine, ink: "text-error-dark", fill: "bg-error-base" },
  unknown: { icon: RiQuestionMark, ink: "text-text-soft", fill: "bg-bg-sub" },
};

export const WORK_CALENDAR_STATUS_LABEL: Record<
  WorkCalendarStatus,
  { id: string; defaultMessage: string }
> = {
  approved: { id: "hub.garden.calendar.status.approved", defaultMessage: "Approved" },
  pending: { id: "hub.garden.calendar.status.pending", defaultMessage: "Pending" },
  rejected: { id: "hub.garden.calendar.status.rejected", defaultMessage: "Rejected" },
  unknown: { id: "hub.garden.calendar.status.unknown", defaultMessage: "Status unread" },
};

/** "14 submissions: 9 approved, 3 pending, 2 rejected", leaving out the zeros. */
export function describeWorkCounts(counts: WorkStatusCounts, intl: IntlShape): string {
  const head = intl.formatMessage(
    {
      id: "hub.garden.calendar.counts",
      defaultMessage: "{count, plural, one {# submission} other {# submissions}}",
    },
    { count: counts.total }
  );
  const parts = STATUS_ORDER.filter((status) => counts[status] > 0).map((status) =>
    intl.formatMessage(
      { id: "hub.garden.calendar.statusCount", defaultMessage: "{count} {status}" },
      {
        count: intl.formatNumber(counts[status]),
        status: intl
          .formatMessage(WORK_CALENDAR_STATUS_LABEL[status])
          .toLocaleLowerCase(intl.locale),
      }
    )
  );
  return parts.length > 0 ? `${head}: ${parts.join(", ")}` : head;
}

/** Icon-and-number marks for a set's statuses. Status never rests on color alone. */
export function StatusMarks({
  counts,
  className,
}: {
  counts: WorkStatusCounts;
  className?: string;
}) {
  const intl = useIntl();
  const shown = STATUS_ORDER.filter((status) => counts[status] > 0);
  if (shown.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      {shown.map((status) => {
        const Icon = STATUS_MARK[status].icon;
        return (
          <span
            key={status}
            className={cn("inline-flex items-center gap-0.5 tabular-nums", STATUS_MARK[status].ink)}
          >
            <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {intl.formatNumber(counts[status])}
          </span>
        );
      })}
    </span>
  );
}

/** A bar whose length is the day's volume and whose segments are its status mix. Decorative. */
export function StatusBar({
  counts,
  scale,
  className,
}: {
  counts: WorkStatusCounts;
  scale: number;
  className?: string;
}) {
  if (counts.total === 0) return null;
  return (
    <span
      aria-hidden
      className={cn("flex h-1.5 overflow-hidden rounded-full bg-bg-soft", className)}
      style={{ width: `${Math.max(scale, 0.08) * 100}%` }}
    >
      {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <span
          key={status}
          className={cn("h-full", STATUS_MARK[status].fill)}
          style={{ width: `${(counts[status] / counts.total) * 100}%` }}
        />
      ))}
    </span>
  );
}
