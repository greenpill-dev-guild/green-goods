import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import { RiDeleteBinLine, RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import type { FailedCommitmentJob } from "@green-goods/shared/commitment-pooling";

interface FailedActRowProps {
  /** The terminal job behind the notice, or null when the queue cannot name it. */
  failed: FailedCommitmentJob | null;
  isBusy: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}

/**
 * An act that gave up, with the two ways out of it, in the notice anatomy the
 * queued act uses (D24, D30): the icon and title on one line, why in two lines,
 * then Discard and Try Again full width. Discard is withheld when the record
 * may already be on chain, and Try Again when the queue says a retry can't
 * help.
 */
export function FailedActRow({ failed, isBusy, onRetry, onDiscard }: FailedActRowProps) {
  const { formatMessage } = useIntl();
  // A named reason stopped the act outright; without one it ran out of tries.
  const title = failed?.reason
    ? formatMessage({ id: "app.commitment.queue.notice.stopped.title" })
    : formatMessage({ id: "app.commitment.queue.notice.failed.title" });
  const body = failed?.reason
    ? formatMessage({ id: `app.commitment.queue.failure.${failed.reason}` })
    : formatMessage({ id: "app.commitment.queue.notice.failed.body" });
  const actions =
    failed && (failed.discardable || failed.retryable) ? (
      <div
        className={
          failed.discardable && failed.retryable
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-2"
        }
      >
        {failed.discardable ? (
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
        {failed.retryable ? (
          <Button
            type="button"
            size="sm"
            onClick={onRetry}
            disabled={isBusy}
            leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: "app.pool.queued.retry" })}
          </Button>
        ) : null}
      </div>
    ) : undefined;

  return (
    <Alert variant="error" layout="stacked" title={title} action={actions}>
      <p data-component="FailedActAlert" data-reason={failed?.reason ?? ""}>
        {body}
      </p>
    </Alert>
  );
}

export interface FailedActAlertProps {
  /** The terminal job behind the alert, or null when the queue cannot name it. */
  failed: FailedCommitmentJob | null;
  /** Re-reads the queue once an act has been retried or thrown away. */
  onChanged: () => void;
}

/**
 * The failed act wired to the queue.
 *
 * The pool tab already offers these for a creation; an act on an existing
 * commitment had only the alert, so its record drove this warning and the
 * drawer's failure badge forever, and a failed proof kept its photos with it.
 * Retrying sends only this act, never the rest of the queue; Discard goes
 * through the queue's own guard.
 */
export function FailedActAlert({ failed, onChanged }: FailedActAlertProps) {
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

  return (
    <FailedActRow
      failed={failed}
      isBusy={busy}
      onRetry={() => void run((jobId) => retryAndSend(jobId))}
      onDiscard={() => void run((jobId) => jobQueue.discardJob(jobId))}
    />
  );
}
