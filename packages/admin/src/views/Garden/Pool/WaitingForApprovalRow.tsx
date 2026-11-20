import { Button } from "@green-goods/shared/components/Button";
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  isStillWaiting,
  type WaitingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
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
  /**
   * Approve… or Accept…, each opening its confirm dialog; none while the booking waits on
   * someone else. `escrow` marks an act on the issuer's escrow (the Safe's approval), which a
   * paused pool doesn't stop, so it stays offered while the pool's own acts wait.
   */
  act: { label: string; onAct: () => void; escrow?: boolean } | null;
  /**
   * The Safe's approval sent from this row this visit, kept as its outcome in the acts' place
   * with the pill line under it, until the booking waits on the steward again (DL-067).
   */
  outcome?: { label: string; at: number };
  /**
   * The pill and line once the row holds an outcome, saying what came of it ("Waiting for the
   * deposit", "Booked · Visit Jan 22"); none while the read has not caught up.
   */
  settled?: { tag: { label: string; tone: ItemRowTone }; detail: string } | null;
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
  // Every state past waiting is decided, so a new kind of outcome never offers the buttons again.
  const decided = !isStillWaiting(state);
  const name = (
    <ClaimantName
      claim={row.claim}
      chainId={chainId}
      className={decided ? "font-medium text-text-sub" : undefined}
    />
  );
  const asked = row.claim.requestedAt * 1000;

  const moment = (ms: number, text: string) => <QueueMoment ms={ms} text={text} />;
  let marker: ReactNode = null;
  let when: ReactNode = moment(asked, age(asked));
  if (voucher?.outcome) {
    when = moment(voucher.outcome.at, clockTime(intl, voucher.outcome.at));
  } else if (state.status === "waiting" && state.isNew) {
    marker = <NewMarker />;
  } else if (state.status === "failed") {
    marker = (
      <span role="status" className="shrink-0 type-label-sm text-error-dark">
        {formatMessage({
          id: "hub.garden.pool.approvals.failed",
          defaultMessage: "Didn’t go through",
        })}
        <span className="sr-only">
          {formatMessage({
            id: "hub.garden.pool.approvals.failedDetail",
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
                ? "hub.garden.pool.approvals.willDo"
                : "hub.garden.pool.approvals.takesUp",
            defaultMessage:
              row.commitment.direction === "REQUEST" ? "{who} will do this" : "{who} takes this up",
          },
          { who: name }
        )
      : name;

  let action: ReactNode;
  if (voucher?.outcome && !decided) {
    action = <OutcomeBadge label={voucher.outcome.label} />;
  } else if (state.status === "signing" || state.status === "confirming") {
    action = (
      <span className="flex items-center gap-1.5">
        <RiLoader4Line
          className="h-4 w-4 shrink-0 animate-spin text-text-soft motion-reduce:animate-none"
          aria-hidden
        />
        <ActPhaseLine phase={item.phase} confirmed="" />
      </span>
    );
  } else if (state.status === "held") {
    // It may still land, or the wallet may still hold it: the line says which, and no Approve.
    action = <ActPhaseLine phase={item.phase} confirmed="" />;
  } else if (state.status === "approved") {
    action = (
      <OutcomeBadge
        // The issuer approves a booking; the pool's steward accepts it.
        label={
          voucher
            ? formatMessage({
                id: "hub.garden.pool.voucher.accepted",
                defaultMessage: "Accepted",
              })
            : formatMessage({
                id: "hub.garden.pool.approvals.approved",
                defaultMessage: "Approved",
              })
        }
      />
    );
  } else if (decided) {
    action = (
      <ClosedBadge
        label={
          state.status === "declined"
            ? formatMessage({
                id: "hub.garden.pool.approvals.declined",
                defaultMessage: "Declined",
              })
            : state.status === "not-chosen"
              ? formatMessage({
                  id: "hub.garden.pool.approvals.notChosen",
                  defaultMessage: "Not chosen",
                })
              : formatMessage({
                  id: "hub.garden.pool.approvals.gone",
                  defaultMessage: "No longer waiting",
                })
        }
      />
    );
  } else if (paused) {
    // A paused pool refuses what writes to it; an act on the issuer's escrow still goes.
    action = voucher?.act?.escrow ? (
      <Button
        type="button"
        emphasis="primary"
        size="compact"
        onClick={voucher.act.onAct}
        disabled={disabled}
      >
        {voucher.act.label}
      </Button>
    ) : null;
  } else {
    const retryLabel = formatMessage({
      id: "hub.garden.pool.approvals.retry",
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
                  id: "hub.garden.pool.approvals.approve",
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
            id: "hub.garden.pool.claims.act.decline",
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
        { id: "hub.garden.pool.voucher.ask.what", defaultMessage: "Booking · {title}" },
        { title }
      )
    : `${directionLabel(row.commitment.direction, formatMessage)} · ${title}`;
  return (
    <QueueRowFrame
      direction={row.commitment.direction}
      isNew={state.status === "waiting" && state.isNew && !voucher?.outcome}
      testId={`pool-claim-${row.claim.commitmentId.toString()}`}
      state={state.status}
      onOpen={onOpen}
      who={who}
      marker={marker}
      when={when}
      line={line}
      action={action}
      // A booking's pill and its line take the row's whole width, under the acts.
      tag={!voucher ? null : decided || voucher.outcome ? (voucher.settled ?? null) : voucher}
    />
  );
}

/** A moment in a queue row: the text a row reads, the full moment on hover. */
export function QueueMoment({ ms, text }: { ms: number; text: string }) {
  const intl = useIntl();
  return (
    <time
      dateTime={isoTime(ms)}
      title={exactTime(intl, ms)}
      className="min-w-0 shrink-[10] truncate type-meta text-text-soft"
    >
      {text}
    </time>
  );
}

/** Marks a row that joined the queue after the visit's first read (rule 4). */
export function NewMarker() {
  const { formatMessage } = useIntl();
  return (
    <span className="shrink-0 type-label-sm text-information-dark">
      {formatMessage({ id: "hub.garden.pool.approvals.new", defaultMessage: "New" })}
    </span>
  );
}

/** What the steward's own act produced, kept in the acts' place for the visit. */
export function OutcomeBadge({ label }: { label: string }) {
  return (
    <StatusBadge variant="success" size="sm" icon={<RiCheckLine className="h-3 w-3" />}>
      {label}
    </StatusBadge>
  );
}

/** A row closed by someone else, or by another act: neutral, with no act left. */
export function ClosedBadge({ label }: { label: string }) {
  return (
    <StatusBadge variant="neutral" size="sm" showIcon={false}>
      {label}
    </StatusBadge>
  );
}

/**
 * One row of Review Promises, whatever waits in it: who and when, then what for, the acts or
 * their outcome on the right, and, for a booking, its pill and line across the row's width.
 * The row keeps one height through every state; the row itself opens its promise.
 */
export function QueueRowFrame({
  direction,
  isNew,
  testId,
  state,
  onOpen,
  who,
  marker,
  when,
  line,
  action,
  tag,
}: {
  direction: Parameters<typeof directionEdgeClass>[0];
  isNew: boolean;
  testId: string;
  state: string;
  onOpen?: () => void;
  who: ReactNode;
  marker?: ReactNode;
  when?: ReactNode;
  line: string;
  action: ReactNode;
  tag: { tag: { label: string; tone: ItemRowTone }; detail: string } | null;
}) {
  const heading = (
    <>
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
    </>
  );
  return (
    <li
      className={cn(
        "grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 ps-3",
        directionEdgeClass(direction),
        isNew && "bg-information-lighter"
      )}
      data-testid={testId}
      data-state={state}
    >
      {onOpen ? (
        <AdminListRow
          onClick={onOpen}
          className="min-w-0 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-1 py-0.5"
        >
          {heading}
        </AdminListRow>
      ) : (
        // A row whose promise isn't read yet opens nothing, so it is text, not a button.
        <div className="min-w-0 px-1 py-0.5">{heading}</div>
      )}
      <div className="flex min-h-7 items-center justify-end gap-1">{action}</div>
      {tag ? (
        <p className="col-span-2 mt-1 flex min-w-0 items-center gap-2 px-1">
          {/* The line takes only the room the pill leaves; the pill, which can name a person,
              gives way only when it alone is wider than the row. */}
          <StatusBadge
            variant={tag.tag.tone}
            size="sm"
            showIcon={false}
            className="min-w-0 max-w-full whitespace-nowrap"
            title={tag.tag.label}
          >
            <span className="min-w-0 truncate">{tag.tag.label}</span>
          </StatusBadge>
          {tag.detail ? (
            <span
              className="min-w-0 flex-1 basis-0 truncate type-meta text-text-soft"
              title={tag.detail}
            >
              {tag.detail}
            </span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
