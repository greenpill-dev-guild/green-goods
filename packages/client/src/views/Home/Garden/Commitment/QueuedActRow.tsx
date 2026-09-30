import type { PendingCommitmentAct } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { logger } from "@green-goods/shared/modules/app/logger";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import { RiDeleteBinLine, RiRefreshLine, RiSendPlaneLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

const ACT_LABEL_IDS: Partial<Record<PendingCommitmentAct["kind"], string>> = {
  claim: "app.commitment.queue.act.claim",
  evidence: "app.commitment.queue.act.evidence",
  workLink: "app.commitment.queue.act.workLink",
  confirmation: "app.commitment.queue.act.confirmation",
};

/** What the row says for each reason the queue gives; any other reason reads as waiting. */
const STATUS_IDS: Partial<Record<string, string>> = {
  "membership-unavailable": "app.commitment.queue.act.waitingMembership",
  "awaiting-confirmation": "app.commitment.queue.act.confirming",
  "send-intent-expired": "app.commitment.queue.act.notSent",
};

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
  /** Sends the act, or, when its send is on record, asks the chain again; it never sends twice. */
  onSendNow: () => void;
  /** Null when the act's transaction may already be on chain, so dropping it is not safe. */
  onDiscard: (() => void) | null;
}

/**
 * An act taken on this phone that has not reached the chain, drawn where the
 * act bar would be.
 *
 * A wallet reader has no background flush: what the queue parks stays parked
 * until they send it themselves, and a screen that only said "waiting" hid
 * the button and left them nothing to press. The row names the act, says why
 * it waits, and offers the two ways out, the same pair the pool tab gives a
 * queued creation.
 */
export function QueuedActRow({
  act,
  isBusy,
  inFlight = false,
  discardFailed = false,
  onSendNow,
  onDiscard,
}: QueuedActRowProps) {
  const { formatMessage } = useIntl();
  const actLabel = formatMessage({
    id: ACT_LABEL_IDS[act.kind] ?? "app.commitment.queue.act.generic",
  });
  const statusId = inFlight
    ? "app.commitment.queue.act.sending"
    : ((act.waitingReason && STATUS_IDS[act.waitingReason]) ?? "app.commitment.queue.act.waiting");
  // A send on record is checked, not sent again, so the button says so.
  const confirming = act.waitingReason === "awaiting-confirmation";
  const locked = isBusy || inFlight;
  return (
    <Alert variant="warning" className="p-3">
      <p
        data-component="QueuedActRow"
        data-kind={act.kind}
        data-reason={act.waitingReason ?? ""}
        data-in-flight={inFlight ? "true" : "false"}
      >
        {formatMessage({ id: statusId }, { act: actLabel })}
      </p>
      <div className={onDiscard ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-1 gap-2"}>
        {onDiscard ? (
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={locked}
            leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: "app.pool.queued.discard" })}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
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
            id: confirming ? "app.commitment.queue.checkAgain" : "app.commitment.queue.sendNow",
          })}
        </Button>
      </div>
      {discardFailed ? (
        <p className="mt-2 text-xs" role="alert">
          {formatMessage({ id: "app.commitment.queue.discardFailed" })}
        </p>
      ) : null}
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
  onChanged,
}: {
  act: PendingCommitmentAct;
  inFlight?: boolean;
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
      onSendNow={() => void sendNow()}
      onDiscard={act.discardable ? () => void discard() : null}
    />
  );
}
