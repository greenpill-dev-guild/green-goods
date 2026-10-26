import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { RiDeleteBinLine, RiRefreshLine, RiSendPlaneLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine, actPhaseText } from "@/components/ActPhaseLine";
import { queuedCreationPill } from "./poolPresentation";
import { rowDueDetail } from "./poolTime";

/** A group past its deadline can't be finished; one with none never lapses. */
export function isPastDeadline(dueDate: bigint | null | undefined, now: number): boolean {
  return Boolean(dueDate) && Number(dueDate) * 1000 <= now;
}

export interface PoolQueuedRowsProps {
  console: PoolConsoleController;
  /** The creations still queued on this device that list as rows of their own. */
  rows: PoolConsoleController["pendingCreates"];
  now: number;
}

/**
 * Creations still queued on this device, above Offers and Requests' indexed
 * rows, so a seeded promise shows up before the indexer has it. Nothing in the
 * admin sends a queued creation on its own, so each row offers the send and,
 * where the queue allows it, the way out (Discard), and leads its line with
 * the act in flight, then why it cannot go, else how much it promises.
 */
export function PoolQueuedRows({ console: pool, rows, now }: PoolQueuedRowsProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { acts, isOnline } = pool;
  const discardLabel = formatMessage({
    id: "cockpit.garden.pool.queued.discard",
    defaultMessage: "Discard",
  });
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const runQueued = async (jobId: string, act: (jobId: string) => Promise<void>) => {
    setBusyJobId(jobId);
    try {
      await act(jobId);
    } finally {
      setBusyJobId(null);
    }
  };
  return (
    <ul className="@container flex flex-col gap-(--gg-list-gap)" data-testid="pool-queued">
      {rows.map((row) => {
        const phase = pool.queuedPhase(row.jobId);
        const pill = queuedCreationPill(row, phase.status, formatMessage);
        const expired =
          !row.hasRecordedSend &&
          isPastDeadline(row.groupDueDate ? BigInt(row.groupDueDate) : null, now);
        const sentLine = formatMessage({
          id: "cockpit.garden.pool.queued.sent",
          defaultMessage: "Sent. This row leaves once the index shows the promise.",
        });
        // What the row says first: the act in flight, then why it cannot go, else how
        // much it promises, since a promise not created yet has no dialog to tell it.
        const said =
          actPhaseText(intl, { phase, chainId: pool.chainId, confirmed: sentLine }) ??
          (expired
            ? formatMessage({
                id: "cockpit.garden.pool.add.expired",
                defaultMessage:
                  "This group's deadline has passed, so nothing can join it. Start a new group instead.",
              })
            : row.settlementDeferred
              ? formatMessage({ id: "app.pool.queued.settlementDeferredNote" })
              : null);
        // A failed act says so in the error color, as its phase line did.
        const note =
          said && phase.status === "failed" ? { text: said, tone: "error" as const } : said;
        const units = note ? null : `${row.targetUnits} ${row.unitLabel}`.trim() || null;
        const sendLabel = row.failed
          ? formatMessage({
              id: "cockpit.garden.pool.queued.retry",
              defaultMessage: "Try Again",
            })
          : formatMessage({
              id: "cockpit.garden.pool.queued.sendNow",
              defaultMessage: "Send Now",
            });
        const SendGlyph = row.failed ? RiRefreshLine : RiSendPlaneLine;
        return (
          <li key={row.jobId}>
            <CommitmentRow
              data-component="PoolQueuedRow"
              direction={row.direction}
              title={
                row.title ??
                formatMessage({
                  id: "cockpit.garden.pool.queued.untitled",
                  defaultMessage: "New promise",
                })
              }
              status={pill.status}
              pending={pill.pending}
              note={note}
              units={units}
              due={row.groupDueDate ? rowDueDetail(intl, BigInt(row.groupDueDate), now) : null}
              action={
                // Stacked below 480px of row, so two acts take one button's width; with
                // no gap their 44px finger boxes fill the 88px row exactly.
                <span className="flex flex-col items-center @[480px]:flex-row @[480px]:gap-1">
                  {row.discardable ? (
                    <IconButton
                      size="sm"
                      aria-label={discardLabel}
                      title={discardLabel}
                      disabled={busyJobId !== null}
                      onClick={() => void runQueued(row.jobId, acts.discardQueued)}
                      icon={<RiDeleteBinLine aria-hidden="true" />}
                    />
                  ) : null}
                  {/* A row that never tried has nothing to try again (A24). */}
                  <IconButton
                    emphasis="secondary"
                    size="sm"
                    aria-label={sendLabel}
                    title={sendLabel}
                    disabled={row.settlementDeferred || !isOnline || busyJobId !== null || expired}
                    loading={busyJobId === row.jobId}
                    onClick={() => void runQueued(row.jobId, acts.retryQueued)}
                    icon={<SendGlyph aria-hidden="true" />}
                  />
                </span>
              }
            />
            {/* The row leads with the phase's words; the line stays for screen
                readers, so each change is still announced. */}
            <ActPhaseLine
              className="sr-only"
              phase={phase}
              chainId={pool.chainId}
              confirmed={sentLine}
            />
          </li>
        );
      })}
    </ul>
  );
}
