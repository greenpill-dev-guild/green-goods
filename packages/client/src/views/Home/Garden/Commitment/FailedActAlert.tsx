import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import { RiDeleteBinLine, RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import type { FailedCommitmentJob } from "@green-goods/shared/commitment-pooling";

export interface FailedActAlertProps {
  /** The terminal job behind the alert, or null when the queue cannot name it. */
  failed: FailedCommitmentJob | null;
  /** Re-reads the queue once an act has been retried or thrown away. */
  onChanged: () => void;
}

/**
 * An act that gave up, with the two ways out of it.
 *
 * The pool tab already offers these for a creation; an act on an existing
 * commitment had only the alert, so its record drove this warning and the
 * drawer's failure badge forever, and a failed proof kept its photos with it.
 * Discard is withheld when the record may already be on chain, the same rule
 * the pool tab applies.
 */
export function FailedActAlert({ failed, onChanged }: FailedActAlertProps) {
  const { formatMessage } = useIntl();
  const { retryAndSend } = useJobQueue();
  const [busy, setBusy] = useState(false);
  const run = async (act: (jobId: string) => Promise<unknown>) => {
    if (!failed) return;
    setBusy(true);
    try {
      await act(failed.jobId);
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  // Retrying this act sends only this act, never the rest of the queue.
  const onRetry = (jobId: string) => retryAndSend(jobId);
  const onDiscard = (jobId: string) => jobQueue.discardJob(jobId);
  const reasonMessage = failed?.reason
    ? formatMessage({ id: `app.commitment.queue.failure.${failed.reason}` })
    : formatMessage({ id: "app.commitment.queue.failed" });

  return (
    <Alert variant="error" className="p-3">
      <p>{reasonMessage}</p>
      {failed ? (
        <div
          className={
            failed.discardable && failed.retryable
              ? "mt-3 grid grid-cols-2 gap-2"
              : "mt-3 grid grid-cols-1 gap-2"
          }
        >
          {failed.discardable ? (
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              onClick={() => void run(onDiscard)}
              disabled={busy}
              leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
            >
              {formatMessage({ id: "app.pool.queued.discard" })}
            </Button>
          ) : null}
          {failed.retryable ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void run(onRetry)}
              disabled={busy}
              leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
            >
              {formatMessage({ id: "app.pool.queued.retry" })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Alert>
  );
}
