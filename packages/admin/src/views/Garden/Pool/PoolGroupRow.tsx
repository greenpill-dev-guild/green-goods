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
}

/** Counts read as plain words here: the pill and the detail line carry no markup. */
const plain = (chunks: string[]) => chunks.join("");

/**
 * Copies made together, as one row in Offers and Requests (PRD-1022 D3), on the shared
 * commitment row: the direction's icon carries the number of copies, the pill says how many
 * are still available, and the details give the shared due date and the rest of the counts.
 * While a copy is still waiting in the steward's queue the pill says how many didn't send,
 * the details what was created, and Finish Creating (n) takes the row's right slot, in place
 * of a separate queued row. The row opens the group's inspector; each copy keeps its own
 * lifecycle, and what each copy is worth is told there.
 */
export function PoolGroupRow({
  group,
  title,
  unsent,
  finishing,
  finishDisabled,
  onOpen,
  onFinish,
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
            id: "cockpit.garden.pool.group.inProgress",
            defaultMessage: "<b>{count}</b> in progress",
          },
          { count: counts.inProgress, b: plain }
        )
      : null,
    counts.kept > 0
      ? formatMessage(
          { id: "cockpit.garden.pool.group.kept", defaultMessage: "<b>{count}</b> kept" },
          { count: counts.kept, b: plain }
        )
      : null,
    counts.ended > 0
      ? formatMessage(
          { id: "cockpit.garden.pool.group.ended", defaultMessage: "<b>{count}</b> ended" },
          { count: counts.ended, b: plain }
        )
      : null,
  ].filter((part): part is string => Boolean(part));
  const finishLabel = formatMessage(
    { id: "cockpit.garden.pool.group.finish", defaultMessage: "Finish Creating ({count})" },
    { count: unsent }
  );

  return (
    <CommitmentRow
      data-component="PoolGroupRow"
      direction={first.direction}
      title={title}
      status={
        unsent > 0
          ? {
              label: formatMessage(
                {
                  id: "cockpit.garden.pool.group.didntSend",
                  defaultMessage: "<b>{count}</b> didn’t send",
                },
                { count: unsent, b: plain }
              ),
              tone: "warning",
            }
          : {
              label: formatMessage(
                {
                  id: "cockpit.garden.pool.group.available",
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
        counts:
          unsent > 0
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.group.created",
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
