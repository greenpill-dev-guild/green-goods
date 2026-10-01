import type {
  DisplayGroupCounts,
  DisplayGroupEntry,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type IntlShape, useIntl } from "react-intl";

import { COMMITMENT_ROW_FRAME } from "./CommitmentRow";

/**
 * A group's counts in one line, availability first: "4 available · 3 in
 * progress · 3 kept". Counts that can't be read say so, alone, rather than
 * reading as none or standing on a read that failed (PRD-1029 c9).
 */
function groupCountsParts(
  intl: Pick<IntlShape, "formatMessage">,
  counts: DisplayGroupCounts,
  { unknown = false }: { unknown?: boolean } = {}
): string[] {
  const { formatMessage } = intl;
  if (unknown) return [formatMessage({ id: "app.pool.group.counts.unknown" })];
  const parts = [
    counts.available > 0
      ? formatMessage({ id: "app.pool.group.counts.available" }, { count: counts.available })
      : formatMessage({ id: "app.pool.group.counts.none" }),
  ];
  if (counts.inProgress > 0) {
    parts.push(
      formatMessage({ id: "app.pool.group.counts.inProgress" }, { count: counts.inProgress })
    );
  }
  if (counts.kept > 0) {
    parts.push(formatMessage({ id: "app.pool.group.counts.kept" }, { count: counts.kept }));
  }
  if (counts.ended > 0) {
    parts.push(formatMessage({ id: "app.pool.group.counts.ended" }, { count: counts.ended }));
  }
  return parts;
}

export function groupCountsText(
  intl: Pick<IntlShape, "formatMessage">,
  counts: DisplayGroupCounts,
  options: { unknown?: boolean } = {}
): string {
  return groupCountsParts(intl, counts, options).join(" · ");
}

export interface PromiseGroupRowProps {
  group: DisplayGroupEntry<CommitmentReadModel>;
  /** The promises' shared name, once their metadata has resolved. */
  title?: string | null;
  /** The last read of the pool failed, so the counts may be out of date. */
  availabilityUnknown?: boolean;
  onOpen?: () => void;
}

/**
 * Many separate promises made alike, as one row (PRD-1029 c1). It keeps the
 * promise row's frame: 88px, the direction's 3px edge, a two-line title. The
 * tile is a stack with the number of promises, so "10" never reads as ten
 * units of one promise, and the line under the title gives the counts,
 * availability first. There is no progress bar and no "Yours": the reader's
 * own copies are ordinary rows beside it.
 */
export function PromiseGroupRow({
  group,
  title,
  availabilityUnknown = false,
  onOpen,
}: PromiseGroupRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const sample = group.children[0];
  const isRequest = sample?.direction === "REQUEST";
  const units = sample?.unitLabel
    ? formatCommitmentUnits(intl, sample.targetUnits, sample.unitLabel)
    : null;
  const primary = title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const count = group.counts.published;
  const name = formatMessage({ id: "app.pool.group.row.name" }, { count });
  const countsParts = groupCountsParts(intl, group.counts, { unknown: availabilityUnknown });
  const Element = onOpen ? "button" : "div";

  return (
    <Element
      {...(onOpen ? { type: "button" as const, onClick: onOpen, "data-pressable": "card" } : {})}
      title={primary}
      className={cn(
        COMMITMENT_ROW_FRAME,
        "focus:outline-none focus-visible:shadow-button-primary-focus",
        isRequest ? "border-s-information-base" : "border-s-primary"
      )}
      data-component="PromiseGroupRow"
      data-direction={sample?.direction}
    >
      {/* A stack of cards, the front one carrying how many promises there are. */}
      <span className="relative mt-1 h-8 w-8 shrink-0" aria-hidden="true">
        <span className="absolute inset-0 translate-x-1 -translate-y-1 rounded-[var(--radius-md)] border border-stroke-soft-200 bg-bg-white-0" />
        <span className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-md)] border border-stroke-soft-200 bg-bg-weak-50 text-xs font-semibold tabular-nums text-text-strong-950">
          {count > 99 ? "99+" : count}
        </span>
      </span>
      <span className="flex h-full min-w-0 flex-1 flex-col justify-between">
        <span className="line-clamp-2 text-sm font-medium leading-[18px] text-text-strong-950">
          <span className="sr-only">{name}: </span>
          {primary}
        </span>
        <span
          className="flex min-h-7 min-w-0 flex-wrap content-end items-center gap-x-1 text-xs leading-[14px] text-text-sub-600"
          data-availability={availabilityUnknown ? "unknown" : "known"}
        >
          {countsParts.map((part, index) => (
            <span key={part} className="whitespace-nowrap">
              {index > 0 ? <span aria-hidden="true">{" · "}</span> : null}
              <span className={index === 0 && !availabilityUnknown ? "font-semibold" : undefined}>
                {part}
              </span>
            </span>
          ))}
        </span>
      </span>
    </Element>
  );
}
