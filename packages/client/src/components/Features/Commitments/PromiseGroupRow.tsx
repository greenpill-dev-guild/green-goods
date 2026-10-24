import type {
  DisplayGroupCounts,
  DisplayGroupEntry,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { type IntlShape, useIntl } from "react-intl";

import { promiseDueDetail } from "./presentation";

/**
 * A group's counts, availability first: "4 available · 3 in progress · 3 kept".
 * Counts that can't be read say so, alone, rather than reading as none or
 * standing on a read that failed (PRD-1029 c9).
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
 * Many separate promises made alike, as one row (PRD-1029 c1), on the shared commitment
 * row: the direction's icon carries the number of promises, so "10" never reads as ten units
 * of one promise. The pill says what is still available, then the details give the shared
 * due date and the rest of the counts. There is no progress bar and no "Yours": the reader's
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
  const units = sample?.unitLabel
    ? formatCommitmentUnits(intl, sample.targetUnits, sample.unitLabel)
    : null;
  const primary = title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const [availability, ...rest] = groupCountsParts(intl, group.counts, {
    unknown: availabilityUnknown,
  });

  return (
    <CommitmentRow
      data-component="PromiseGroupRow"
      data-availability={availabilityUnknown ? "unknown" : "known"}
      direction={sample?.direction}
      title={primary}
      status={{
        label: availability,
        tone: !availabilityUnknown && group.counts.available > 0 ? "info" : "neutral",
      }}
      due={promiseDueDetail(intl, sample?.dueDate)}
      group={{ size: group.counts.published, counts: rest.join(", ") }}
      onOpen={onOpen}
    />
  );
}
