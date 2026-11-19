import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  isStillWaiting,
  useWaitingForApproval,
  type WaitingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import {
  type IssuerSafeThreshold,
  selectCanApproveBooking,
  selectVoucherAskStage,
  type VoucherAsk,
  type VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type {
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import type { AdminDialogProps } from "@/components/AdminDialog";
import type { PoolWriteTarget } from "./PoolTarget";
import { VoucherAcceptDialog, VoucherApproveDialog } from "./VoucherAskDialogs";
import { type VoucherBookingAct, VoucherBookingDialogs } from "./VoucherBookingDialogs";
import { VoucherRowAct } from "./VoucherRowAct";
import { WaitingBookingRow } from "./WaitingBookingRow";
import { WaitingForApprovalRow, type VoucherAskRowView } from "./WaitingForApprovalRow";
import {
  voucherAskAct,
  voucherAskDetail,
  voucherAskTag,
  voucherBookingAct,
} from "./voucherPresentation";
import {
  bookingRowKey,
  emptyQueueVisit,
  type QueueDone,
  queueBookedTag,
  queueBookingTag,
  queueDoneLabel,
  queueDoneTag,
  reconcileQueueVisit,
  recordQueueDone,
} from "./voucherQueue";

export interface PoolClaimsCardProps {
  console: PoolConsoleController;
  /** The voucher bookings in the pool: their asks, and the bookings under way. */
  vouchers: VoucherConsoleView;
  /** The pool an acceptance or a visit report writes to, named in its dialog. */
  target: PoolWriteTarget;
  /** The issuer Safe's signature rule, read from the Safe, for its dialogs. */
  safe?: IssuerSafeThreshold;
  tone?: AdminDialogProps["tone"];
  onDecline: (row: PoolClaimRequestRow) => void;
  /** Open the ask's promise, at its waiting list. */
  onOpen: (row: PoolClaimRequestRow) => void;
  /** Open the promise a booking under way is for. */
  onOpenPromise: (commitment: CommitmentReadModel) => void;
}

/** A Safe file changes nothing until the signers execute it, so only a sent act has an outcome. */
const sendsDirectly = (issuer: VoucherBooking["issuer"]) => issuer.execution !== "safe-file";

/**
 * Review Promises (PRD-1025, named by DL-077), at the top of the Promises tab's
 * right column and first on a phone: everything that waits on the steward, in
 * one queue. It is always there, one quiet line when nothing waits, so it
 * never moves the promises on the left (D1, D8).
 *
 * Rows hold their place for the visit (`useWaitingForApproval`): a decision
 * turns a row into its outcome, which stays until the steward leaves the tab,
 * and a new row joins the end marked New. Approve is one signature (hub
 * decision 31) and Decline… asks for a reason first; approving one closes the
 * others on the same promise. While the pool is paused the acts are absent,
 * not disabled: the contract refuses them, so the rows only wait.
 *
 * A voucher booking (PRD-1297 surface 6) is an ask the contract refuses to
 * approve in one tap: its issuer's Safe approves it first (Approve…, offered
 * only to an owner of that Safe), the member deposits, and only then the
 * pool's steward accepts it through `acceptServiceClaim` (Accept…), each in a
 * dialog with its facts or checks. Once under way, a booking waits here for
 * the steward's next act (decision 1 of the 18 November 2026 hub-day review):
 * a visit to report once it has begun, a return to propose once the service
 * stopped early, a transfer to retry. One person's booking keeps one row from
 * ask to report. An act sent from a row this visit stays as its outcome until
 * the booking waits on the steward for something else.
 */
export function PoolClaimsCard({
  console: pool,
  vouchers,
  target,
  safe,
  tone,
  onDecline,
  onOpen,
  onOpenPromise,
}: PoolClaimsCardProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { titles, model, isOnline, isActing, claimInFlight, acts, chainId } = pool;
  const approvals = useWaitingForApproval(pool);
  const [approving, setApproving] = useState<VoucherAsk | null>(null);
  const [accepting, setAccepting] = useState<VoucherAsk | null>(null);
  const [bookingAct, setBookingAct] = useState<VoucherBookingAct>(null);
  // Each booking's ask as last read this visit, by its row: an accepted ask leaves the voucher
  // read, and its row still reads Accepted, "Booking · …", while the visit keeps it.
  const visit = `${chainId}:${pool.garden.toLowerCase()}`;
  const [seen, setSeen] = useState({ visit, asks: new Map<string, VoucherAsk>() });
  const known = seen.visit === visit ? seen.asks : new Map<string, VoucherAsk>();
  const live = approvals.rows.flatMap((item) => {
    const ask = vouchers.askFor(item.row.claim.commitmentId, item.row.claim.claimant);
    return ask ? [[item.key, ask] as const] : [];
  });
  if (seen.visit !== visit || live.some(([key, ask]) => known.get(key) !== ask)) {
    setSeen({ visit, asks: new Map([...known, ...live]) });
  }
  // The queue's own visit: its order across asks and bookings, the bookings that came due,
  // and the acts sent from it. Taken while rendering, as the asks' visit is.
  const [queue, setQueue] = useState(() => emptyQueueVisit(visit));
  const nextQueue = reconcileQueueVisit(queue, {
    pool: visit,
    askKeys: approvals.rows.map((item) => item.key),
    vouchers,
  });
  if (nextQueue !== queue) setQueue(nextQueue);
  const record = (key: string, act: QueueDone["act"]) =>
    setQueue((current) => recordQueueDone(current, key, { act, at: Date.now() }));

  const askOf = (item: WaitingRow) =>
    vouchers.askFor(item.row.claim.commitmentId, item.row.claim.claimant) ??
    (isStillWaiting(item.state) ? undefined : known.get(item.key));
  // One decision at a time: the wallet asks for one, from this card or the inspector.
  const disabled = !isOnline || isActing || claimInFlight;
  const nowMs = vouchers.now * 1000;
  const untitled = (commitmentId: bigint) =>
    formatMessage(
      { id: "hub.garden.pool.row.untitled", defaultMessage: "Promise {id}" },
      { id: commitmentId.toString() }
    );
  const titleOf = (commitment: PoolClaimRequestRow["commitment"]) =>
    (commitment.metadataCID && titles.get(commitment.metadataCID.trim())?.title) ??
    untitled(commitment.commitmentId);
  const promiseOf = (commitmentId: bigint) =>
    pool.commitments.find((row) => row.commitmentId === commitmentId) ??
    pool.claims.find((row) => row.claim.commitmentId === commitmentId)?.commitment;
  const titleById = (commitmentId: bigint) => {
    const promise = promiseOf(commitmentId);
    return promise ? titleOf(promise) : untitled(commitmentId);
  };
  // Read live: the account, or the Safe's owners, can change while an approval is open.
  const approves = (ask: VoucherAsk) =>
    selectCanApproveBooking({ ask, issuer: vouchers.snapshot.issuer, safe, viewer: pool.viewer });
  const approveBooking = async (ask: VoucherAsk) => {
    if (!approves(ask))
      throw new Error("Only an owner of the issuer's Safe can approve this booking");
    await vouchers.acts.approveBooking(ask);
    if (sendsDirectly(ask.issuer)) record(bookingRowKey({ ...ask, holder: ask.buyer }), "approve");
  };
  const bookingActs: Pick<VoucherConsoleView, "acts"> = {
    acts: {
      ...vouchers.acts,
      reportVisit: async (booking) => {
        await vouchers.acts.reportVisit(booking);
        if (sendsDirectly(booking.issuer)) record(bookingRowKey(booking), "report");
      },
      proposeReturn: async (booking, ceiling) => {
        await vouchers.acts.proposeReturn(booking, ceiling);
        if (sendsDirectly(booking.issuer)) record(bookingRowKey(booking), "propose");
      },
    },
  };
  // The open act follows its booking as the read has it now (another Safe owner can raise the
  // return ceiling meanwhile), and closes once the booking leaves the read.
  const openBooking = bookingAct && vouchers.bookingFor(bookingAct.booking.commitmentId);
  if (bookingAct && !openBooking) setBookingAct(null);
  const openAct: VoucherBookingAct =
    bookingAct && openBooking ? { kind: bookingAct.kind, booking: openBooking } : null;
  // A booking as the read has it now, if it is still the same person's.
  const liveBooking = (booking: VoucherBooking) => {
    const now = vouchers.bookingFor(booking.commitmentId);
    return now && bookingRowKey(now) === bookingRowKey(booking) ? now : undefined;
  };

  const voucherView = (item: WaitingRow): VoucherAskRowView | undefined => {
    const ask = askOf(item);
    if (!ask) return undefined;
    const stage = selectVoucherAskStage(ask, vouchers.now);
    const act = voucherAskAct(stage, approves(ask));
    const done = queue.done.get(item.key);
    // The Safe's approval sent here holds as its outcome until accepting is the next act.
    const outcome =
      done?.act === "approve" && act !== "accept"
        ? { label: queueDoneLabel("approve", formatMessage), at: done.at }
        : undefined;
    const booked = vouchers.bookingFor(ask.commitmentId);
    const live = {
      tag: voucherAskTag(ask, stage, approves(ask), formatMessage),
      detail: voucherAskDetail(ask, stage, intl, nowMs),
    };
    return {
      ...live,
      outcome,
      // Once approved here, the line says what the booking waits on next, when the read says.
      settled: outcome
        ? act === "approve"
          ? null
          : live
        : booked && bookingRowKey(booked) === item.key
          ? queueBookedTag(booked, vouchers, intl, nowMs)
          : null,
      act:
        outcome || act === null
          ? null
          : act === "approve"
            ? {
                label: formatMessage({
                  id: "hub.garden.pool.voucher.act.approve",
                  defaultMessage: "Approve…",
                }),
                onAct: () => setApproving(ask),
              }
            : {
                label: formatMessage({
                  id: "hub.garden.pool.voucher.act.accept",
                  defaultMessage: "Accept…",
                }),
                onAct: () => setAccepting(ask),
              },
    };
  };

  // One row a person and promise, in the order first seen: their ask, then their booking's act.
  const asks = new Map(approvals.rows.map((item) => [item.key, item]));
  const order = [...queue.order, ...[...asks.keys()].filter((key) => !queue.order.includes(key))];
  let waiting = 0;
  let decidedCount = 0;
  let everyRowIsABooking = true;
  const rows: ReactNode[] = order.flatMap((key) => {
    const item = asks.get(key);
    const tracked = queue.bookings.get(key);
    const booking = tracked ? (liveBooking(tracked) ?? tracked) : undefined;
    const due = tracked && liveBooking(tracked) ? voucherBookingAct(booking!, vouchers.now) : null;
    const done = queue.done.get(key);
    const doneHere = done && done.act !== "approve" ? done : undefined;
    if (booking && (due || doneHere || !item)) {
      const state =
        due && due !== doneHere?.act
          ? ({
              status: "waiting",
              act: (
                <VoucherRowAct
                  booking={booking}
                  act={due}
                  disabled={disabled}
                  onOpen={(kind) => setBookingAct({ kind, booking })}
                  onRetry={vouchers.acts.retryTransfer}
                />
              ),
            } as const)
          : doneHere
            ? ({
                status: "done",
                label: queueDoneLabel(doneHere.act, formatMessage),
                at: doneHere.at,
              } as const)
            : ({ status: "gone" } as const);
      if (state.status === "waiting") waiting += 1;
      else decidedCount += 1;
      const promise = promiseOf(booking.commitmentId);
      return [
        <WaitingBookingRow
          key={key}
          booking={booking}
          title={titleById(booking.commitmentId)}
          isNew={queue.arrived.has(key)}
          state={state}
          tagFor={(name) =>
            state.status === "waiting"
              ? queueBookingTag(booking, due!, vouchers, intl, nowMs)
              : doneHere
                ? queueDoneTag(booking, doneHere.act, name, formatMessage)
                : null
          }
          nowMs={nowMs}
          onOpen={promise ? () => onOpenPromise(promise) : undefined}
        />,
      ];
    }
    if (!item) return [];
    const voucher = voucherView(item);
    if (!voucher) everyRowIsABooking = false;
    if (isStillWaiting(item.state) && !voucher?.outcome) waiting += 1;
    else decidedCount += 1;
    return [
      <WaitingForApprovalRow
        key={key}
        item={item}
        title={titleOf(item.row.commitment)}
        chainId={chainId}
        paused={model.isPaused}
        disabled={disabled}
        onOpen={() => onOpen(item.row)}
        onApprove={() =>
          void acts
            .acceptClaim(item.row.claim.commitmentId, item.row.claim.claimant)
            .catch(() => undefined)
        }
        onDecline={() => onDecline(item.row)}
        voucher={voucher}
      />,
    ];
  });

  const description = model.isPaused
    ? formatMessage({
        id: "hub.garden.pool.claims.paused",
        defaultMessage: "Requests wait while the pool is paused.",
      })
    : decidedCount === 0
      ? everyRowIsABooking
        ? formatMessage({
            id: "hub.garden.pool.approvals.bookingsDescription",
            defaultMessage:
              "Everything waiting on you: bookings to approve, deposits to accept and visits to report.",
          })
        : formatMessage({
            id: "hub.garden.pool.approvals.description",
            defaultMessage:
              "Neighbors asking to take a promise up. Approving one closes the others on that promise.",
          })
      : formatMessage(
          {
            id: "hub.garden.pool.approvals.decidedThisVisit",
            defaultMessage:
              "{waiting, plural, =0 {Nothing waiting now.} other {# waiting.}} {decided, plural, one {# decided this visit; it clears when you leave the Promises tab.} other {# decided this visit; they clear when you leave the Promises tab.}}",
          },
          { waiting, decided: decidedCount }
        );

  return (
    <AdminCard
      variant="elevated"
      data-component="PoolClaimsCard"
      data-testid="pool-claims"
      id="pool-claims"
      className="space-y-2"
    >
      <div>
        <AdminCardTitle>
          {formatMessage({
            id: "hub.garden.pool.approvals.title",
            defaultMessage: "Review Promises",
          })}
        </AdminCardTitle>
        <p className="mt-1 type-body text-text-soft">
          {rows.length === 0
            ? formatMessage({
                id: "hub.garden.pool.approvals.empty",
                defaultMessage: "Nothing to review.",
              })
            : description}
        </p>
      </div>
      {rows.length > 0 ? <ul className="divide-y divide-stroke-soft">{rows}</ul> : null}
      <VoucherApproveDialog
        ask={approving}
        title={approving ? titleById(approving.commitmentId) : ""}
        safe={safe}
        nowMs={nowMs}
        disabled={disabled || (approving !== null && !approves(approving))}
        tone={tone}
        onClose={() => setApproving(null)}
        onApprove={approveBooking}
      />
      <VoucherAcceptDialog
        ask={accepting}
        title={accepting ? titleById(accepting.commitmentId) : ""}
        target={target}
        now={vouchers.now}
        phase={
          accepting ? pool.claimPhase(accepting.commitmentId, accepting.buyer) : { status: "idle" }
        }
        disabled={disabled}
        tone={tone}
        onClose={() => setAccepting(null)}
        onAccept={acts.acceptServiceClaim}
      />
      <VoucherBookingDialogs
        open={openAct}
        title={openAct ? titleById(openAct.booking.commitmentId) : ""}
        vouchers={bookingActs}
        safe={safe}
        target={target}
        nowMs={nowMs}
        disabled={disabled}
        tone={tone}
        onClose={() => setBookingAct(null)}
      />
    </AdminCard>
  );
}
