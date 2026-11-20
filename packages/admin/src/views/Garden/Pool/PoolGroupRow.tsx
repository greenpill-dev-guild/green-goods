import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiSendPlaneLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import type { PoolCommitmentGroup } from "./poolCommitmentRows";
import { rowDueDetail } from "./poolTime";

export interface PoolGroupRowProps {
  group: PoolCommitmentGroup;
  title: string;
  /** Copies of the group still waiting in this steward's queue. */
  unsent: number;
  /** Finish Creating is sending this group's copies. */
  finishing: boolean;
  /** Offline, or another group is being finished. */
  finishDisabled: boolean;
  onOpen: () => void;
  onFinish: () => void;
  /**
   * The copies are a voucher offer's (decision 2 of the hub-day review): the row counts them
   * booked and open, and says what one booking takes when the read knows.
   */
  voucher?: { takes: string | null } | null;
}

/** Counts read as plain words here: the pill and the detail line carry no markup. */
const plain = (chunks: string[]) => chunks.join("");

/**
 * Copies made together, as one row in Offers and Asks (PRD-1022 D3), on the shared
 * commitment row: the direction's icon carries the number of copies, the pill says how many
 * are still available, and the details give the shared due date and the rest of the counts.
 * While a copy is still waiting in the steward's queue the pill says how many didn't send,
 * the details what was created, and Finish Creating (n) takes the row's right slot, in place
 * of a separate queued row. The row opens the group's inspector; each copy keeps its own
 * lifecycle, and what each copy is worth is told there. A voucher offer's copies count as
 * bookings instead: the pill says whether any is open, the line what one booking takes, and the
 * right slot how many are booked (and kept) over how many of all are still open.
 */
export function PoolGroupRow({
  group,
  title,
  unsent,
  finishing,
  finishDisabled,
  onOpen,
  onFinish,
  voucher,
}: PoolGroupRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [first] = group.children;
  if (!first) return null;
  const { counts } = group;
  const later = [
    counts.inProgress > 0
      ? formatMessage(
          {
            id: "hub.garden.pool.group.inProgress",
            defaultMessage: "<b>{count}</b> in progress",
          },
          { count: counts.inProgress, b: plain }
        )
      : null,
    counts.kept > 0
      ? formatMessage(
          { id: "hub.garden.pool.group.kept", defaultMessage: "<b>{count}</b> kept" },
          { count: counts.kept, b: plain }
        )
      : null,
    counts.ended > 0
      ? formatMessage(
          { id: "hub.garden.pool.group.ended", defaultMessage: "<b>{count}</b> ended" },
          { count: counts.ended, b: plain }
        )
      : null,
  ].filter((part): part is string => Boolean(part));
  const finishLabel = formatMessage(
    { id: "hub.garden.pool.group.finish", defaultMessage: "Finish Creating ({count})" },
    { count: unsent }
  );

  const voucherCounts = voucher
    ? {
        status: {
          // None open: fully booked only when no copy ended, else how many ended.
          label:
            counts.available > 0
              ? formatMessage({ id: "hub.garden.pool.group.open", defaultMessage: "Open" })
              : counts.ended > 0
                ? formatMessage(
                    { id: "hub.garden.pool.group.ended", defaultMessage: "<b>{count}</b> ended" },
                    { count: counts.ended, b: plain }
                  )
                : formatMessage({
                    id: "hub.garden.pool.group.fullyBooked",
                    defaultMessage: "Fully booked",
                  }),
          tone: counts.available > 0 ? ("info" as const) : ("neutral" as const),
        },
        amount: {
          value:
            counts.kept > 0
              ? formatMessage(
                  {
                    id: "hub.garden.pool.group.bookedKept",
                    defaultMessage: "{booked} booked · {kept} kept",
                  },
                  { booked: counts.inProgress, kept: counts.kept }
                )
              : formatMessage(
                  { id: "hub.garden.pool.group.booked", defaultMessage: "{booked} booked" },
                  { booked: counts.inProgress }
                ),
          caption: formatMessage(
            { id: "hub.garden.pool.group.openOf", defaultMessage: "{open} of {total} open" },
            { open: counts.available, total: counts.published }
          ),
        },
      }
    : null;
  // Finish Creating keeps the right slot while a copy is unsent; the counts move to the line.
  const booked = unsent === 0 ? voucherCounts : null;

  return (
    <CommitmentRow
      data-component="PoolGroupRow"
      direction={first.direction}
      title={title}
      units={booked ? voucher?.takes : undefined}
      amount={booked?.amount}
      status={
        booked
          ? booked.status
          : unsent > 0
            ? {
                label: formatMessage(
                  {
                    id: "hub.garden.pool.group.didntSend",
                    defaultMessage: "<b>{count}</b> didn’t send",
                  },
                  { count: unsent, b: plain }
                ),
                tone: "warning",
              }
            : {
                label: formatMessage(
                  {
                    id: "hub.garden.pool.group.available",
                    defaultMessage: "<b>{count}</b> available",
                  },
                  { count: counts.available, b: plain }
                ),
                tone: counts.available > 0 ? "info" : "neutral",
              }
      }
      due={rowDueDetail(intl, first.dueDate, Date.now())}
      group={{
        size: counts.published,
        // A voucher offer's counts are in the right slot, or in the line beside Finish Creating.
        counts: booked
          ? ""
          : unsent > 0 && voucherCounts
            ? `${voucherCounts.amount.value} · ${voucherCounts.amount.caption}`
            : unsent > 0
              ? formatMessage(
                  {
                    id: "hub.garden.pool.group.created",
                    defaultMessage: "<b>{count}</b> created",
                  },
                  { count: counts.published, b: plain }
                )
              : later.join(", "),
      }}
      onOpen={onOpen}
      action={
        unsent > 0 ? (
          <IconButton
            emphasis="secondary"
            size="sm"
            aria-label={finishLabel}
            title={finishLabel}
            onClick={onFinish}
            loading={finishing}
            disabled={finishDisabled || finishing}
            icon={<RiSendPlaneLine aria-hidden="true" />}
          />
        ) : undefined
      }
    />
  );
}
