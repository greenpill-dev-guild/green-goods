import type { ButtonProps } from "@green-goods/shared/components/Button";
import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
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
  /** How the primary sends when a press is not all of it: the form it submits, its 18px icon. */
  sendButtonProps?: Pick<ButtonProps, "type" | "form" | "leadingIcon">;
  /** Said beside the Review's buttons: how often the wallet asks, or why sending is off. */
  note?: ReactNode;
  /** Next is held: the step has nothing chosen yet. */
  nextDisabled?: boolean;
  /** The Review's primary is held: what it would send is not complete; `note` says why. */
  sendDisabled?: boolean;
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
  sendDisabled = false,
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
      <SheetActions
        primary={{
          label: formatMessage({ id: "app.common.done", defaultMessage: "Done" }),
          onClick: onDone,
        }}
        secondary={another ? { label: another.label, onClick: another.onClick } : undefined}
      />
    );
  }

  const waiting = held || phase === "sending";
  const isFirst = stepIndex === 0;
  const back = {
    label: isFirst
      ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
      : formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
    onClick: isFirst ? onCancel : onBack,
    disabled: waiting,
  };

  if (!isLast) {
    return (
      <SheetActions
        layout="steps"
        primary={{
          label: formatMessage({ id: "app.common.next", defaultMessage: "Next" }),
          onClick: onNext,
          disabled: waiting || nextDisabled,
        }}
        secondary={back}
      />
    );
  }

  return (
    <SheetActions
      layout="steps"
      note={note ?? null}
      primary={{
        type: sendButtonProps?.type,
        form: sendButtonProps?.form,
        icon: sendButtonProps?.leadingIcon,
        label:
          phase === "failed"
            ? formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })
            : sendLabel,
        onClick: onSend,
        loading: phase === "sending",
        disabled: waiting || sendDisabled,
      }}
      secondary={back}
    />
  );
}
