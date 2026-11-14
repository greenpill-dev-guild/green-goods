/**
 * Garden reporting lab (proposed component): a record set's statuses as icon-and-number
 * marks, and as a proportion bar. Status never rests on color: each mark has its glyph
 * and its words for screen readers, and the bar is decoration beside them.
 */
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiCheckLine,
  RiCloseLine,
  RiQuestionMark,
  RiTimeLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import type { StatusCounts } from "./aggregate";
import { formatNumber, STATUS_COPY } from "./labCopy";
import type { StatusView } from "./model";

const ORDER: readonly StatusView[] = ["approved", "pending", "rejected", "unknown"];

// Pending is neutral, as the Hub's cards and the Activity Feed say it: waiting is
// metadata, never an alarm (DL-044). Its clock glyph tells it from an unread status.
const MARK: Record<StatusView, { icon: RemixiconComponentType; ink: string; fill: string }> = {
  approved: { icon: RiCheckLine, ink: "text-success-dark", fill: "bg-success-base" },
  pending: { icon: RiTimeLine, ink: "text-text-sub", fill: "bg-text-soft" },
  rejected: { icon: RiCloseLine, ink: "text-error-dark", fill: "bg-error-base" },
  unknown: { icon: RiQuestionMark, ink: "text-text-soft", fill: "bg-bg-sub" },
};

export function StatusIcon({ status, className }: { status: StatusView; className?: string }) {
  const Icon = MARK[status].icon;
  return <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", MARK[status].ink, className)} />;
}

interface StatusMarksProps {
  counts: StatusCounts;
  locale: string;
  className?: string;
}

/** "✓ 9  ◷ 3  ✕ 2": zeros are left out, so a day with no rejections shows no rejection mark. */
export function StatusMarks({ counts, locale, className }: StatusMarksProps) {
  const shown = ORDER.filter((status) => counts[status] > 0);
  if (shown.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      {shown.map((status) => (
        <span
          key={status}
          className={cn("inline-flex items-center gap-0.5 tabular-nums", MARK[status].ink)}
        >
          <StatusIcon status={status} />
          <span aria-hidden>{formatNumber(counts[status], locale)}</span>
          <span className="sr-only">
            {formatNumber(counts[status], locale)} {STATUS_COPY[status].label.toLowerCase()}
          </span>
        </span>
      ))}
    </span>
  );
}

interface StatusBarProps {
  counts: StatusCounts;
  /** The bar's length against the largest set beside it, 0 to 1. */
  scale?: number;
  className?: string;
}

/** A segmented bar: its length is the volume, its segments the status mix. Decorative. */
export function StatusBar({ counts, scale = 1, className }: StatusBarProps) {
  if (counts.total === 0) return null;
  return (
    <span
      aria-hidden
      className={cn("flex h-1.5 overflow-hidden rounded-full bg-bg-soft", className)}
      style={{ width: `${Math.max(scale, 0.08) * 100}%` }}
    >
      {ORDER.filter((status) => counts[status] > 0).map((status) => (
        <span
          key={status}
          className={cn("h-full", MARK[status].fill)}
          style={{ width: `${(counts[status] / counts.total) * 100}%` }}
        />
      ))}
    </span>
  );
}
