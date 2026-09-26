import type { PendingCommitmentAct } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import { RiDeleteBinLine, RiSendPlaneLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

const ACT_LABEL_IDS: Partial<Record<PendingCommitmentAct["kind"], string>> = {
  claim: "app.commitment.queue.act.claim",
  evidence: "app.commitment.queue.act.evidence",
  workLink: "app.commitment.queue.act.workLink",
  confirmation: "app.commitment.queue.act.confirmation",
};

export interface QueuedActRowProps {
  act: PendingCommitmentAct;
  isBusy: boolean;
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
export function QueuedActRow({ act, isBusy, onSendNow, onDiscard }: QueuedActRowProps) {
  const { formatMessage } = useIntl();
  const actLabel = formatMessage({
    id: ACT_LABEL_IDS[act.kind] ?? "app.commitment.queue.act.generic",
  });
  const waitingId =
    act.waitingReason === "membership-unavailable"
      ? "app.commitment.queue.act.waitingMembership"
      : "app.commitment.queue.act.waiting";
  return (
    <Alert variant="warning" className="p-3">
      <p data-component="QueuedActRow" data-kind={act.kind} data-reason={act.waitingReason ?? ""}>
        {formatMessage({ id: waitingId }, { act: actLabel })}
      </p>
      <div className={onDiscard ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-1 gap-2"}>
        {onDiscard ? (
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={isBusy}
            leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: "app.pool.queued.discard" })}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={onSendNow}
          disabled={isBusy}
          leadingIcon={<RiSendPlaneLine className="h-4 w-4" aria-hidden="true" />}
        >
          {formatMessage({ id: "app.commitment.queue.sendNow" })}
        </Button>
      </div>
    </Alert>
  );
}

/**
 * The row wired to the queue. Send Now sends only this act, as the person's
 * own tap, never the rest of the queue; Discard goes through the queue's own
 * guard, which refuses when the send may be on chain.
 */
export function QueuedActNotice({
  act,
  onChanged,
}: {
  act: PendingCommitmentAct;
  onChanged: () => void;
}) {
  const { retryAndSend } = useJobQueue();
  const [busy, setBusy] = useState(false);
  const run = async (perform: (jobId: string) => Promise<unknown>) => {
    setBusy(true);
    try {
      await perform(act.jobId);
    } catch {
      // The queue reports a failed send on its own surfaces; the row re-reads.
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  return (
    <QueuedActRow
      act={act}
      isBusy={busy}
      onSendNow={() => void run(retryAndSend)}
      onDiscard={act.discardable ? () => void run((jobId) => jobQueue.discardJob(jobId)) : null}
    />
  );
}
