import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton, type AdminButtonProps } from "@/components/AdminButton";
import type { FlowStatusTone } from "./FlowStatusRow";

/** Where a create flow's send stands, as its Review step and its footer show it. */
export type FlowSendPhase = "ready" | "sending" | "sent" | "failed";

/**
 * What the Review's status row (`FlowStatusRow`) says at one moment of the send.
 * Each flow has one function that writes it, so the row and the footer never
 * read the same send two ways.
 */
export interface FlowSendStatus {
  phase: FlowSendPhase;
  tone: FlowStatusTone;
  busy: boolean;
  title: string;
  description: string;
}

/**
 * The phase, read from the flags a flow's controller already keeps. A send that
 * landed stays sent whatever else is set, so nothing returns it to Try Again.
 */
export function flowSendPhase(send: {
  sending: boolean;
  sent: boolean;
  failed: boolean;
}): FlowSendPhase {
  if (send.sent) return "sent";
  if (send.sending) return "sending";
  return send.failed ? "failed" : "ready";
}

/**
 * The footer note for a send that is one wallet request: how often the wallet
 * asks, then that the dialog waits for it. Seed Promises says the same of one promise.
 */
export function SingleSendNote({ phase }: { phase: FlowSendPhase }) {
  const { formatMessage } = useIntl();
  return phase === "sending"
    ? formatMessage({
        id: "app.admin.flow.send.waiting",
        defaultMessage: "The dialog stays open until your wallet answers.",
      })
    : formatMessage({
        id: "app.admin.flow.send.walletAsksOnce",
        defaultMessage: "Your wallet will ask you once.",
      });
}

export interface FlowSendFooterProps {
  /** Zero-based step: the first offers Cancel, every later one Back. */
  stepIndex: number;
  /** The Review, whose primary sends. */
  isLast: boolean;
  /** Where the send stands; on the Review the buttons follow it. */
  phase: FlowSendPhase;
  /** The act the Review's primary performs, as its label ("Submit Assessment"). */
  sendLabel: string;
  /** How the primary sends when a press is not all of it: the form it submits, its icon. */
  sendButtonProps?: Pick<AdminButtonProps, "type" | "form" | "leadingIcon">;
  /** Said beside the Review's buttons: how often the wallet asks, or why sending is off. */
  note?: ReactNode;
  /** Next is held: the step has nothing chosen yet. */
  nextDisabled?: boolean;
  /** Work outside the send is under way (media still preparing), so every button waits. */
  held?: boolean;
  /** Starts an empty flow from the done state. Left out where the flow makes one thing only. */
  another?: { label: string; onClick: () => void };
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSend: () => void;
  onDone: () => void;
}

/**
 * FlowSendFooter — the pinned footer of a create flow that ends on a Review
 * step whose primary sends (DL-080). Until the Review it goes back and on. On
 * the Review the buttons follow the send, as Seed Promises does: the act, then
 * Try Again for a send that failed or was declined, then Done. A send that
 * landed leaves no way back into the steps, so the footer offers only Done and,
 * where the flow makes more than one thing, a fresh start.
 */
export function FlowSendFooter({
  stepIndex,
  isLast,
  phase,
  sendLabel,
  sendButtonProps,
  note,
  nextDisabled = false,
  held = false,
  another,
  onCancel,
  onBack,
  onNext,
  onSend,
  onDone,
}: FlowSendFooterProps) {
  const { formatMessage } = useIntl();

  if (phase === "sent") {
    return (
      <div
        data-component="FlowSendFooter"
        data-phase={phase}
        className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
      >
        {another ? (
          <AdminButton
            type="button"
            variant="outlined"
            onClick={another.onClick}
            className="w-full sm:w-auto"
          >
            {another.label}
          </AdminButton>
        ) : null}
        <AdminButton type="button" variant="filled" onClick={onDone} className="w-full sm:w-auto">
          {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
        </AdminButton>
      </div>
    );
  }

  const waiting = held || phase === "sending";
  const isFirst = stepIndex === 0;
  const back = (
    <AdminButton
      type="button"
      variant={isFirst ? "text" : "outlined"}
      onClick={isFirst ? onCancel : onBack}
      disabled={waiting}
      className="self-start sm:self-auto"
    >
      {isFirst
        ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
        : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
    </AdminButton>
  );

  if (!isLast) {
    return (
      <div
        data-component="FlowSendFooter"
        data-phase={phase}
        className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
      >
        {back}
        <AdminButton
          type="button"
          variant="filled"
          onClick={onNext}
          disabled={waiting || nextDisabled}
          className="w-full sm:w-auto"
        >
          {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
        </AdminButton>
      </div>
    );
  }

  return (
    <div
      data-component="FlowSendFooter"
      data-phase={phase}
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
    >
      <p className="min-w-0 body-xs text-text-soft sm:flex-1">
        {note ? <span role="status">{note}</span> : null}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {back}
        <AdminButton
          type="button"
          {...sendButtonProps}
          variant="filled"
          onClick={onSend}
          loading={phase === "sending"}
          disabled={waiting}
          className="w-full sm:w-auto"
        >
          {phase === "failed"
            ? formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })
            : sendLabel}
        </AdminButton>
      </div>
    </div>
  );
}
