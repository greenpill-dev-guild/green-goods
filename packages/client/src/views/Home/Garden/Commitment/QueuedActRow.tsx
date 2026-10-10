import type { PendingCommitmentAct } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { logger } from "@green-goods/shared/modules/app/logger";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import {
  RiAlertLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSendPlaneLine,
  RiTimeLine,
} from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";

interface NoticeCopy {
  tone: "warning" | "info";
  icon: ReactNode;
  titleId: string;
  bodyId: string;
  bodyValues?: Record<string, string>;
}

const OPERATION_COPY: Record<
  PendingCommitmentAct["kind"],
  { titleId: string; sendId: string; discardId: string }
> = {
  commitmentSeries: {
    titleId: "app.commitment.queue.operation.series",
    sendId: "app.commitment.queue.send.series",
    discardId: "app.commitment.queue.discard.series",
  },
  commitment: {
    titleId: "app.commitment.queue.operation.promise",
    sendId: "app.commitment.queue.send.promise",
    discardId: "app.commitment.queue.discard.promise",
  },
  claim: {
    titleId: "app.commitment.queue.operation.claim",
    sendId: "app.commitment.queue.send.claim",
    discardId: "app.commitment.queue.discard.claim",
  },
  evidence: {
    titleId: "app.commitment.queue.operation.proof",
    sendId: "app.commitment.queue.send.proof",
    discardId: "app.commitment.queue.discard.proof",
  },
  workLink: {
    titleId: "app.commitment.queue.operation.workLink",
    sendId: "app.commitment.queue.send.workLink",
    discardId: "app.commitment.queue.discard.workLink",
  },
  confirmation: {
    titleId: "app.commitment.queue.operation.confirmation",
    sendId: "app.commitment.queue.send.confirmation",
    discardId: "app.commitment.queue.discard.confirmation",
  },
};

const ICON = "h-5 w-5 flex-shrink-0";

/** A wallet reader's act whose last send failed: saved, not sent, and why. */
function failedSendCopy(failure: NonNullable<PendingCommitmentAct["sendFailure"]>): NoticeCopy {
  return {
    tone: "warning",
    icon: <RiAlertLine className={ICON} aria-hidden="true" />,
    titleId: "app.commitment.queue.notice.waiting.title",
    bodyId: failure.messageId,
    bodyValues: failure.values,
  };
}

/**
 * What the notice says for each state; any reason the queue gives besides these
 * reads as waiting. A reader who sends from their own tap is never told the act
 * sends itself: it says why the last send failed, when one did, and that it
 * waits for them.
 */
function noticeCopy(
  act: PendingCommitmentAct,
  inFlight: boolean,
  sendsFromTap: boolean
): NoticeCopy {
  if (inFlight) {
    return {
      tone: "warning",
      icon: <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />,
      titleId: "app.commitment.queue.notice.sending.title",
      bodyId: "app.commitment.queue.notice.sending.body",
    };
  }
  switch (act.waitingReason) {
    case "awaiting-confirmation":
      return {
        tone: "info",
        icon: <RiRefreshLine className={ICON} aria-hidden="true" />,
        titleId: "app.commitment.queue.notice.checking.title",
        bodyId: "app.commitment.queue.notice.checking.body",
      };
    case "send-intent-expired":
      // A declined network switch marks the act as a declined signature does.
      // Only the change of network was declined, so it reads as the network.
      if (sendsFromTap && act.sendFailure?.walletNetwork) return failedSendCopy(act.sendFailure);
      return {
        tone: "warning",
        icon: <RiAlertLine className={ICON} aria-hidden="true" />,
        titleId: "app.commitment.queue.notice.notSent.title",
        bodyId: "app.commitment.queue.notice.notSent.body",
      };
    case "membership-unavailable":
      return {
        tone: "warning",
        icon: <RiTimeLine className={ICON} aria-hidden="true" />,
        titleId: "app.commitment.queue.notice.membership.title",
        bodyId: sendsFromTap
          ? "app.commitment.queue.notice.membership.bodyUnsent"
          : "app.commitment.queue.notice.membership.body",
      };
    default:
      if (sendsFromTap && act.sendFailure) return failedSendCopy(act.sendFailure);
      return {
        tone: "warning",
        icon: <RiTimeLine className={ICON} aria-hidden="true" />,
        titleId: "app.commitment.queue.notice.waiting.title",
        bodyId: sendsFromTap
          ? "app.commitment.queue.notice.unsent.body"
          : "app.commitment.queue.notice.waiting.body",
      };
  }
}

export interface QueuedActRowProps {
  act: PendingCommitmentAct;
  isBusy: boolean;
  /**
   * The screen's own send of this act is still running (the wallet may be
   * asking). Both recovery acts wait: a discard now could delete the record of
   * a transaction about to broadcast, and a second send would race the first.
   */
  inFlight?: boolean;
  /** The last Discard did not remove the act, so say so rather than silently redraw it. */
  discardFailed?: boolean;
  /**
   * The reader sends queued acts themselves (a wallet sign-in): nothing sends
   * this one for them, so the notice says why it did not go and never that it
   * will. Passkey and embedded sign-ins have a background flush, and keep the
   * copy that says so.
   */
  sendsFromTap?: boolean;
  /** Sends the act, or, when its send is on record, asks the chain again; it never sends twice. */
  onSendNow: () => void;
  /** Null when the act's transaction may already be on chain, so dropping it is not safe. */
  onDiscard: (() => void) | null;
}

/**
 * An act taken on this phone that has not reached the chain, drawn at the top
 * of the promise.
 *
 * A wallet reader has no background flush: what the queue parks stays parked
 * until they send it themselves, and a screen that only said "waiting" hid
 * the button and left them nothing to press. The notice says what state the
 * act is in and why in two lines, then offers the two ways out full width, the
 * same pair the pool tab gives a queued creation (D24, D30). The page's History
 * names the act.
 */
export function QueuedActRow({
  act,
  isBusy,
  inFlight = false,
  discardFailed = false,
  sendsFromTap = false,
  onSendNow,
  onDiscard,
}: QueuedActRowProps) {
  const { formatMessage } = useIntl();
  const copy = noticeCopy(act, inFlight, sendsFromTap);
  const operation =
    act.kind === "confirmation" && act.confirmationAction === "submit"
      ? {
          titleId: "app.commitment.queue.operation.submission",
          sendId: "app.commitment.queue.send.submission",
          discardId: "app.commitment.queue.discard.submission",
        }
      : OPERATION_COPY[act.kind];
  // A send on record is checked, not sent again, so the button says so.
  const confirming = act.waitingReason === "awaiting-confirmation";
  const locked = isBusy || inFlight;
  const actions = (
    <>
      <div className="flex flex-row-reverse flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="w-full min-w-0 whitespace-normal sm:grow sm:basis-[calc(50%-0.25rem)]"
          onClick={onSendNow}
          disabled={locked}
          leadingIcon={
            confirming ? (
              <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
            ) : (
              <RiSendPlaneLine className="h-4 w-4" aria-hidden="true" />
            )
          }
        >
          {formatMessage({
            id: confirming ? "app.commitment.queue.checkAgain" : operation.sendId,
          })}
        </Button>
        {onDiscard ? (
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            className="w-full min-w-0 whitespace-normal sm:grow sm:basis-[calc(50%-0.25rem)]"
            onClick={onDiscard}
            disabled={locked}
            leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: operation.discardId })}
          </Button>
        ) : null}
      </div>
      {discardFailed ? (
        <p className="mt-2 text-xs" role="alert">
          {formatMessage({ id: "app.commitment.queue.discardFailed" })}
        </p>
      ) : null}
    </>
  );

  return (
    <Alert
      variant={copy.tone}
      layout="stacked"
      icon={copy.icon}
      title={formatMessage({ id: copy.titleId })}
      action={actions}
    >
      <p className="mb-1 font-semibold">{formatMessage({ id: operation.titleId })}</p>
      <p
        data-component="QueuedActRow"
        data-kind={act.kind}
        data-reason={act.waitingReason ?? ""}
        data-in-flight={inFlight ? "true" : "false"}
      >
        {formatMessage({ id: copy.bodyId }, copy.bodyValues)}
      </p>
    </Alert>
  );
}

/**
 * The row wired to the queue. Send Now sends only this act, as the person's
 * own tap, never the rest of the queue; on a send already on record it asks the
 * chain whether it landed instead of sending again. Its failures reach the person through
 * the queue's own toasts and the failed-act alert. Discard goes through the
 * queue's guard, which refuses when the send may be on chain, and a refusal or
 * a storage error is said in the row.
 */
export function QueuedActNotice({
  act,
  inFlight = false,
  sendsFromTap = false,
  onChanged,
}: {
  act: PendingCommitmentAct;
  inFlight?: boolean;
  sendsFromTap?: boolean;
  onChanged: () => void;
}) {
  const { retryAndSend } = useJobQueue();
  const [busy, setBusy] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);

  const sendNow = async () => {
    setBusy(true);
    setDiscardFailed(false);
    try {
      await retryAndSend(act.jobId);
    } catch (error) {
      logger.warn("[QueuedActNotice] Send Now did not complete", {
        jobId: act.jobId,
        kind: act.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const discard = async () => {
    setBusy(true);
    setDiscardFailed(false);
    try {
      const discarded = await jobQueue.discardJob(act.jobId);
      if (!discarded) setDiscardFailed(true);
    } catch (error) {
      logger.error("[QueuedActNotice] Discard failed", {
        jobId: act.jobId,
        kind: act.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      setDiscardFailed(true);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <QueuedActRow
      act={act}
      isBusy={busy}
      inFlight={inFlight}
      discardFailed={discardFailed}
      sendsFromTap={sendsFromTap}
      onSendNow={() => void sendNow()}
      onDiscard={act.discardable ? () => void discard() : null}
    />
  );
}
