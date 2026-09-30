import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import type { WaitingRow } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiLoader4Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
import { AdminListRow } from "@/components/AdminListRow";
import { ClaimantName } from "./ClaimantName";
import { directionEdgeClass, directionLabel } from "./poolPresentation";
import { clockTime, exactTime, isoTime } from "./poolTime";

export interface WaitingForApprovalRowProps {
  item: WaitingRow;
  title: string;
  chainId: number;
  /** The pool is paused: the contract refuses a decision, so the row only waits. */
  paused: boolean;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onDecline: () => void;
}

/**
 * One ask in Waiting for approval (PRD-1025 D6): two lines, who and when, then
 * what for, in a row that keeps one height through every state. Decline… and
 * Approve sit on the right; pressing Approve puts the act's progress in their
 * place, then the outcome it produced, which stays for the visit. A failure
 * brings the pair back as Try Again. The row itself opens its promise.
 */
export function WaitingForApprovalRow({
  item,
  title,
  chainId,
  paused,
  disabled,
  onOpen,
  onApprove,
  onDecline,
}: WaitingForApprovalRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const age = useLocalizedRelativeTime();
  const { row, state } = item;
  const decided =
    state.status === "approved" ||
    state.status === "declined" ||
    state.status === "not-chosen" ||
    state.status === "gone";
  const name = (
    <ClaimantName
      claim={row.claim}
      chainId={chainId}
      className={decided ? "font-medium text-text-sub" : undefined}
    />
  );
  const asked = row.claim.requestedAt * 1000;

  const moment = (ms: number, text: string) => (
    <time
      dateTime={isoTime(ms)}
      title={exactTime(intl, ms)}
      className="min-w-0 shrink-[10] truncate body-xs text-text-soft"
    >
      {text}
    </time>
  );
  let marker: ReactNode = null;
  let when: ReactNode = moment(asked, age(asked));
  if (state.status === "waiting" && state.isNew) {
    marker = (
      <span className="shrink-0 label-xs text-information-dark">
        {formatMessage({ id: "cockpit.garden.pool.approvals.new", defaultMessage: "New" })}
      </span>
    );
  } else if (state.status === "failed") {
    marker = (
      <span role="status" className="shrink-0 label-xs text-error-dark">
        {formatMessage({
          id: "cockpit.garden.pool.approvals.failed",
          defaultMessage: "Didn’t go through",
        })}
        <span className="sr-only">
          {formatMessage({
            id: "cockpit.garden.pool.approvals.failedDetail",
            defaultMessage: ", and nothing changed. You can try again.",
          })}
        </span>
      </span>
    );
    when = null;
  } else if (state.status === "gone") {
    when = null;
  } else if (
    state.status === "approved" ||
    state.status === "declined" ||
    state.status === "not-chosen"
  ) {
    when = moment(state.at, clockTime(intl, state.at));
  }

  const who =
    state.status === "approved"
      ? formatMessage(
          {
            id:
              row.commitment.direction === "REQUEST"
                ? "cockpit.garden.pool.approvals.willDo"
                : "cockpit.garden.pool.approvals.takesUp",
            defaultMessage:
              row.commitment.direction === "REQUEST" ? "{who} will do this" : "{who} takes this up",
          },
          { who: name }
        )
      : name;

  let action: ReactNode;
  if (state.status === "signing" || state.status === "confirming") {
    action = (
      <span className="flex items-center gap-1.5">
        <RiLoader4Line
          className="h-4 w-4 shrink-0 animate-spin text-text-soft motion-reduce:animate-none"
          aria-hidden
        />
        <ActPhaseLine phase={item.phase} chainId={chainId} confirmed="" />
      </span>
    );
  } else if (state.status === "approved") {
    action = (
      <StatusBadge variant="success" size="sm" icon={<RiCheckLine />}>
        {formatMessage({
          id: "cockpit.garden.pool.approvals.approved",
          defaultMessage: "Approved",
        })}
      </StatusBadge>
    );
  } else if (decided) {
    action = (
      <StatusBadge variant="neutral" size="sm">
        {state.status === "declined"
          ? formatMessage({
              id: "cockpit.garden.pool.approvals.declined",
              defaultMessage: "Declined",
            })
          : state.status === "not-chosen"
            ? formatMessage({
                id: "cockpit.garden.pool.approvals.notChosen",
                defaultMessage: "Not chosen",
              })
            : formatMessage({
                id: "cockpit.garden.pool.approvals.gone",
                defaultMessage: "No longer waiting",
              })}
      </StatusBadge>
    );
  } else if (paused) {
    action = null;
  } else {
    action = (
      <>
        <AdminButton type="button" variant="text" size="sm" onClick={onDecline} disabled={disabled}>
          {formatMessage({
            id: "cockpit.garden.pool.claims.act.decline",
            defaultMessage: "Decline…",
          })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="filled"
          size="sm"
          onClick={onApprove}
          disabled={disabled}
        >
          {state.status === "failed"
            ? formatMessage({ id: "cockpit.garden.pool.setup.retry", defaultMessage: "Try Again" })
            : formatMessage({
                id: "cockpit.garden.pool.approvals.approve",
                defaultMessage: "Approve",
              })}
        </AdminButton>
      </>
    );
  }

  const line = `${directionLabel(row.commitment.direction, formatMessage)} · ${title}`;
  return (
    <li
      className={cn(
        "grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 ps-3",
        directionEdgeClass(row.commitment.direction),
        state.status === "waiting" && state.isNew && "bg-information-lighter"
      )}
      data-testid={`pool-claim-${row.claim.commitmentId.toString()}`}
      data-state={state.status}
    >
      <AdminListRow
        onClick={onOpen}
        className="min-w-0 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-1 py-0.5"
      >
        <span className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span className="min-w-0 truncate">{who}</span>
          {marker}
          {when}
        </span>
        <span className="mt-0.5 block truncate body-xs text-text-sub" title={line}>
          {line}
        </span>
      </AdminListRow>
      <div className="flex min-h-7 items-center justify-end gap-1">{action}</div>
    </li>
  );
}
