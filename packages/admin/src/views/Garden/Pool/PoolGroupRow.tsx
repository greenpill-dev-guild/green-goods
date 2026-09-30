import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiArrowRightSLine, RiStackLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminListRow } from "@/components/AdminListRow";
import type { PoolCommitmentGroup } from "./poolCommitmentRows";
import { directionEdgeClass, directionLabel } from "./poolPresentation";
import { dueDateText } from "./poolTime";

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

const bold = (chunks: ReactNode[]) => (
  <b className="font-semibold text-text-strong tabular-nums">{chunks}</b>
);
const warningBold = (chunks: ReactNode[]) => <b className="font-semibold tabular-nums">{chunks}</b>;

/**
 * Copies made together, as one row on the Promises card (PRD-1022 D3): the
 * record row with a count chip, and a count line over every published copy:
 * available, in progress, kept and, once any, ended. While a copy is still
 * waiting in the steward's queue the line says what was created and what
 * didn't send, beside Finish Creating (n), in place of a separate queued row.
 * The row opens the group's inspector; each copy keeps its own lifecycle.
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
  const each = `${first.targetUnits.toString()} ${first.unitLabel ?? ""}`.trim();

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 py-2 ps-3 ${directionEdgeClass(first.direction)}`}
      data-testid={`pool-group-${group.displayGroupId}`}
    >
      {/* The text keeps a 240px basis, so on a narrow card Finish Creating
          wraps under it, on the right, instead of squeezing the counts. */}
      <AdminListRow
        onClick={onOpen}
        className="flex min-w-0 grow basis-60 items-center gap-3 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-0 py-1"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap body-xs text-text-soft">
              {directionLabel(first.direction, formatMessage)}
            </span>
            <span className="truncate text-body-md text-text-strong" title={title}>
              {title}
            </span>
            <StatusBadge variant="neutral" size="sm" icon={<RiStackLine className="h-3 w-3" />}>
              {formatMessage(
                {
                  id: "cockpit.garden.pool.group.chip",
                  defaultMessage: "{count, plural, one {# promise} other {# promises}}",
                },
                { count: counts.published }
              )}
            </StatusBadge>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 body-xs text-text-sub">
            {unsent > 0 ? (
              <>
                <span>
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.group.created",
                      defaultMessage: "<b>{count}</b> created",
                    },
                    { count: counts.published, b: bold }
                  )}
                </span>
                <span className="text-warning-dark">
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.group.didntSend",
                      defaultMessage: "<b>{count}</b> didn’t send",
                    },
                    { count: unsent, b: warningBold }
                  )}
                </span>
              </>
            ) : (
              <>
                <span>
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.group.available",
                      defaultMessage: "<b>{count}</b> available",
                    },
                    { count: counts.available, b: bold }
                  )}
                </span>
                <span>
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.group.inProgress",
                      defaultMessage: "<b>{count}</b> in progress",
                    },
                    { count: counts.inProgress, b: bold }
                  )}
                </span>
                <span>
                  {formatMessage(
                    { id: "cockpit.garden.pool.group.kept", defaultMessage: "<b>{count}</b> kept" },
                    { count: counts.kept, b: bold }
                  )}
                </span>
                {counts.ended > 0 ? (
                  <span>
                    {formatMessage(
                      {
                        id: "cockpit.garden.pool.group.ended",
                        defaultMessage: "<b>{count}</b> ended",
                      },
                      { count: counts.ended, b: bold }
                    )}
                  </span>
                ) : null}
              </>
            )}
            <span>
              {formatMessage(
                {
                  id: "cockpit.garden.pool.group.terms",
                  defaultMessage: "· {each} each · due {date}",
                },
                {
                  each,
                  date: dueDateText(intl, Number(first.dueDate ?? 0n) * 1000, Date.now()),
                }
              )}
            </span>
          </span>
        </span>
        <RiArrowRightSLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden />
      </AdminListRow>
      {unsent > 0 ? (
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          className="ms-auto"
          onClick={onFinish}
          loading={finishing}
          disabled={finishDisabled || finishing}
        >
          {formatMessage(
            {
              id: "cockpit.garden.pool.group.finish",
              defaultMessage: "Finish Creating ({count})",
            },
            { count: unsent }
          )}
        </AdminButton>
      ) : null}
    </li>
  );
}
