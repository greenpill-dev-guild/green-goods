import { Button } from "@green-goods/shared/components/Button";
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { WaitingRow } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiLoader4Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminListRow } from "@/components/AdminListRow";
import { ClaimantName } from "./ClaimantName";
import { directionEdgeClass, directionLabel } from "./poolPresentation";
import { clockTime, exactTime, isoTime } from "./poolTime";

/** A voucher booking's ask, which the pool's steward never approves in one tap. */
export interface VoucherAskRowView {
  /** What the booking waits on now. */
  tag: { label: string; tone: ItemRowTone };
  /** When the member agreed, what the escrow holds, and the deadline. */
  detail: string;
  /** Approve… or Accept…, each opening its confirm dialog; none while the booking waits on someone else. */
  act: { label: string; onAct: () => void } | null;
}

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
  /** Set when the ask is a voucher booking: its acts open dialogs with their checks. */
  voucher?: VoucherAskRowView;
}

/**
 * One ask in Review Promises (PRD-1025 D6): two lines, who and when, then
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
  voucher,
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
      className="min-w-0 shrink-[10] truncate type-meta text-text-soft"
    >
      {text}
    </time>
  );
  let marker: ReactNode = null;
  let when: ReactNode = moment(asked, age(asked));
  if (state.status === "waiting" && state.isNew) {
    marker = (
      <span className="shrink-0 type-label-sm text-information-dark">
        {formatMessage({ id: "cockpit.garden.pool.approvals.new", defaultMessage: "New" })}
      </span>
    );
  } else if (state.status === "failed") {
    marker = (
      <span role="status" className="shrink-0 type-label-sm text-error-dark">
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
      <StatusBadge variant="success" size="sm" icon={<RiCheckLine className="h-3 w-3" />}>
        {/* The issuer approves a booking; the pool's steward accepts it. */}
        {voucher
          ? formatMessage({
              id: "cockpit.garden.pool.voucher.accepted",
              defaultMessage: "Accepted",
            })
          : formatMessage({
              id: "cockpit.garden.pool.approvals.approved",
              defaultMessage: "Approved",
            })}
      </StatusBadge>
    );
  } else if (decided) {
    action = (
      <StatusBadge variant="neutral" size="sm" showIcon={false}>
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
    const retryLabel = formatMessage({
      id: "cockpit.garden.pool.approvals.retry",
      defaultMessage: "Try Again",
    });
    // A voucher booking's act opens its dialog, and one that waits on someone else has none.
    const primary = voucher
      ? voucher.act && {
          label: state.status === "failed" ? retryLabel : voucher.act.label,
          onClick: voucher.act.onAct,
        }
      : {
          // Its own id: es and pt need a label short enough to leave the row its name.
          label:
            state.status === "failed"
              ? retryLabel
              : formatMessage({
                  id: "cockpit.garden.pool.approvals.approve",
                  defaultMessage: "Approve",
                }),
          onClick: onApprove,
        };
    action = (
      <>
        <Button
          type="button"
          emphasis="tertiary"
          size="compact"
          onClick={onDecline}
          disabled={disabled}
        >
          {formatMessage({
            id: "cockpit.garden.pool.claims.act.decline",
            defaultMessage: "Decline…",
          })}
        </Button>
        {primary ? (
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={primary.onClick}
            disabled={disabled}
          >
            {primary.label}
          </Button>
        ) : null}
      </>
    );
  }

  const line = voucher
    ? formatMessage(
        { id: "cockpit.garden.pool.voucher.ask.what", defaultMessage: "Booking · {title}" },
        { title }
      )
    : `${directionLabel(row.commitment.direction, formatMessage)} · ${title}`;
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
          {/* The name keeps its length and the age gives way first (D6); only a
              name wider than the whole line is cut. */}
          <span className="max-w-full shrink-0 truncate type-body text-text-sub">{who}</span>
          {marker}
          {when}
        </span>
        <span className="mt-0.5 block truncate type-meta text-text-sub" title={line}>
          {line}
        </span>
      </AdminListRow>
      <div className="flex min-h-7 items-center justify-end gap-1">{action}</div>
      {/* A booking's pill and its line take the row's whole width, under the acts. */}
      {voucher && !decided ? (
        <p className="col-span-2 mt-1 flex min-w-0 items-center gap-2 px-1">
          <StatusBadge
            variant={voucher.tag.tone}
            size="sm"
            showIcon={false}
            className="shrink-0 whitespace-nowrap"
          >
            {voucher.tag.label}
          </StatusBadge>
          <span className="min-w-0 truncate type-meta text-text-soft" title={voucher.detail}>
            {voucher.detail}
          </span>
        </p>
      ) : null}
    </li>
  );
}
