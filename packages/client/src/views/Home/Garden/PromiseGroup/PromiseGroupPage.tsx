import { Button } from "@green-goods/shared/components/Button";
import type { CommitmentReadModel, InboxCommitment } from "@green-goods/shared/commitment-pooling";
import type { DisplayGroupCounts } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { GroupTakeUpBar } from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { RiHandHeartLine, RiRefreshLine, RiSeedlingLine, RiTimeLine } from "@remixicon/react";
import { type ReactNode, useId } from "react";
import { useIntl } from "react-intl";

import { CommitmentRow, groupCountsText } from "@/components/Features/Commitments";
import { CommitmentActionBar } from "../Commitment/CommitmentActionBar";
import { CommitmentDetailShell } from "../Commitment/CommitmentDetailShell";
import { Fact } from "../Commitment/CommitmentPeople";

/** The words for the group's one act, on the bar and in the sheet. */
export const GROUP_ACT_LABEL = {
  takeUp: "app.pool.group.act.takeUpOne",
  takeUpAnother: "app.pool.group.act.takeUpAnother",
  askToTakeUp: "app.pool.group.act.askToTakeUpOne",
} as const;

const HOLD_REASON = {
  limit: "app.pool.group.hold.limit",
  none: "app.pool.group.hold.none",
  unknown: "app.pool.group.counts.unknown",
} as const;

export interface PromiseGroupPageProps {
  /** The promises' shared name. */
  title: string;
  /** One copy, for the terms every copy shares. */
  sample: CommitmentReadModel;
  /** The promises' shared note, in the words they were made with. */
  note: string | null;
  counts: DisplayGroupCounts;
  availabilityKnown: boolean;
  /** The pool's at-once limit, stated for promises it counts against. */
  cap: bigint | null;
  yours: InboxCommitment[];
  bar: GroupTakeUpBar | null;
  isPending: boolean;
  isOnline: boolean;
  queueUnreadable: boolean;
  /** Shown in place of the act to a reader who doesn't belong yet. */
  join?: ReactNode;
  onBack: () => void;
  onRefresh: () => void;
  onRun: () => void;
  onOpenCopy: (commitmentId: bigint) => void;
}

/**
 * A group's page (PRD-1029 c2): what each promise asks, in the words it was
 * made with; how many are available, in progress and kept, and that finishing
 * yours never waits for anyone else; then the reader's own copies. The bar's
 * one act takes up one copy the app picks. Held, it says why: the pool's
 * at-once limit, none available, or availability that can't be read.
 */
export function PromiseGroupPage({
  title,
  sample,
  note,
  counts,
  availabilityKnown,
  cap,
  yours,
  bar,
  isPending,
  isOnline,
  queueUnreadable,
  join = null,
  onBack,
  onRefresh,
  onRun,
  onOpenCopy,
}: PromiseGroupPageProps) {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const asksId = useId();
  const nowId = useId();
  const yoursId = useId();
  const isRequest = sample.direction === "REQUEST";
  const units = sample.unitLabel
    ? formatCommitmentUnits(intl, sample.targetUnits, sample.unitLabel)
    : null;
  const sectionClass = "rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4";
  const headingClass = "text-sm font-semibold leading-5 text-text-strong-950";

  return (
    <CommitmentDetailShell
      onBack={onBack}
      title={title}
      bar={
        bar ? (
          <CommitmentActionBar
            act={{
              kind: bar.act === "askToTakeUp" ? "askToTakeUp" : "takeUp",
              labelId: GROUP_ACT_LABEL[bar.act],
            }}
            isPending={isPending}
            isOnline={isOnline}
            blockedReasonId={
              queueUnreadable
                ? "app.commitments.queueUnreadable"
                : bar.hold
                  ? HOLD_REASON[bar.hold]
                  : null
            }
            onRun={onRun}
          />
        ) : null
      }
    >
      <section className={sectionClass} aria-labelledby={asksId}>
        <h2 id={asksId} className={headingClass}>
          {formatMessage({ id: "app.pool.group.eachAsks" })}
        </h2>
        <dl className="mt-1 divide-y divide-stroke-soft-200">
          {units ? (
            <Fact
              icon={isRequest ? <RiHandHeartLine /> : <RiSeedlingLine />}
              label={formatMessage({
                id: isRequest
                  ? "app.commitments.direction.request"
                  : "app.commitments.direction.offer",
              })}
              value={units}
            />
          ) : null}
          {sample.dueDate ? (
            <Fact
              icon={<RiTimeLine />}
              label={formatMessage({ id: "app.commitment.people.due" })}
              value={formatDate(new Date(Number(sample.dueDate) * 1000), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          ) : null}
        </dl>
        {note ? <p className="mt-2 text-sm leading-relaxed text-text-sub-600">{note}</p> : null}
        {cap !== null && isRequest ? (
          <p className="mt-2 text-xs text-text-sub-600">
            {formatMessage({ id: "app.pool.group.cap" }, { cap: cap.toString() })}
          </p>
        ) : null}
      </section>

      <section className={sectionClass} aria-labelledby={nowId}>
        <h2 id={nowId} className={headingClass}>
          {formatMessage({ id: "app.pool.group.rightNow" })}
        </h2>
        <div className="mt-2 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className="text-sm font-medium text-text-strong-950"
            data-component="PromiseGroupCounts"
            data-availability={availabilityKnown ? "known" : "unknown"}
          >
            {groupCountsText(intl, counts, { unknown: !availabilityKnown })}
          </p>
          {availabilityKnown ? null : (
            <Button
              type="button"
              emphasis="tertiary"
              size="sm"
              onClick={onRefresh}
              leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
            >
              {formatMessage({ id: "app.common.refresh" })}
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-text-sub-600">
          {formatMessage({ id: "app.pool.group.onItsOwn" })}
        </p>
      </section>

      {join}

      {yours.length > 0 ? (
        <section aria-labelledby={yoursId} className="space-y-2">
          <h2 id={yoursId} className={headingClass}>
            {formatMessage({ id: "app.pool.group.yours" })}
          </h2>
          {yours.map((row) => (
            <CommitmentRow key={row.commitment.id} row={row} title={title} onOpen={onOpenCopy} />
          ))}
        </section>
      ) : null}
    </CommitmentDetailShell>
  );
}
