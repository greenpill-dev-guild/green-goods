import { Alert } from "@green-goods/shared/components/Alert";
import { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { useJobQueue } from "@green-goods/shared/providers/JobQueue";
import { RiDeleteBinLine, RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface FailedActAlertProps {
  /** The terminal job behind the alert, or null when the queue cannot name it. */
  failed: { jobId: string; discardable: boolean } | null;
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
  const { flush } = useJobQueue();
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
  const onRetry = async (jobId: string) => {
    await jobQueue.retryJob(jobId);
    await flush();
  };
  const onDiscard = (jobId: string) => jobQueue.discardJob(jobId);

  return (
    <Alert variant="error" className="p-3">
      <p>{formatMessage({ id: "app.commitment.queue.failed" })}</p>
      {failed ? (
        <div
          className={
            failed.discardable ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-1 gap-2"
          }
        >
          {failed.discardable ? (
            <button
              type="button"
              onClick={() => void run(onDiscard)}
              disabled={busy}
              className="flex items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-xs font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
            >
              <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.queued.discard" })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void run(onRetry)}
            disabled={busy}
            className="flex items-center justify-center gap-1 rounded-[var(--radius-lg)] bg-primary-action px-3 py-2 text-xs font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
          >
            <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "app.pool.queued.retry" })}
          </button>
        </div>
      ) : null}
    </Alert>
  );
}
