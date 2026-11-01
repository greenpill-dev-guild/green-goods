import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import type { ReviewBatch } from "@green-goods/shared/hooks/work/useWorkApproval";
import { useIntl } from "react-intl";

interface HubReviewBatchBarProps {
  /** Whose work these reviews decide, named beside the button that sends them. */
  gardenName?: string;
  batch: Pick<
    ReviewBatch,
    | "approvals"
    | "rejections"
    | "signatures"
    | "signatureStep"
    | "sendSize"
    | "blockedCount"
    | "reviews"
    | "isSending"
    | "send"
    | "unstageBlocked"
  >;
}

/**
 * What a steward has decided and not yet sent, and the one button that sends it. It says how many
 * signatures that takes before anyone presses, and which one a send is on, so a wallet prompt is
 * never a surprise. Nothing goes out until they press, and the list keeps on this device till then.
 */
export function HubReviewBatchBar({ gardenName, batch }: HubReviewBatchBarProps) {
  const { formatMessage } = useIntl();
  const { approvals, rejections, signatures, signatureStep, sendSize, blockedCount } = batch;
  const { reviews, isSending, send, unstageBlocked } = batch;
  const count = approvals + rejections;
  if (count === 0) return null;

  const tally = [
    approvals > 0 ? formatMessage({ id: "app.work.batch.approvals" }, { count: approvals }) : null,
    rejections > 0
      ? formatMessage({ id: "app.work.batch.rejections" }, { count: rejections })
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  const isRefused = reviews.some(({ refusal }) => refusal);

  return (
    <section
      aria-label={formatMessage({ id: "app.work.batch.label" })}
      className="hub-review-batch-bar flex flex-col gap-3 rounded-xl border border-stroke-soft bg-bg-white p-3 shadow-[var(--admin-chrome-shadow)]"
      data-component="HubReviewBatchBar"
    >
      {blockedCount > 0 ? (
        <Alert
          variant="warning"
          action={
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              onClick={unstageBlocked}
              disabled={isSending}
            >
              {formatMessage({ id: "app.work.batch.blocked.takeOut" })}
            </Button>
          }
        >
          {isRefused
            ? formatMessage({ id: "app.work.batch.blocked.refused" }, { count: blockedCount })
            : formatMessage({ id: "app.work.batch.blocked.notBatchable" })}
        </Alert>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="type-title-sm text-text-strong">{tally}</p>
          <p className="type-meta text-text-soft" role="status">
            {[
              gardenName,
              isSending
                ? formatMessage(
                    { id: "app.work.batch.signatureStep" },
                    { step: signatureStep, total: sendSize }
                  )
                : formatMessage({ id: "app.treasury.signatures" }, { count: signatures }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          type="button"
          emphasis="primary"
          size="sm"
          onClick={() => void send()}
          loading={isSending}
          data-action="send-batch"
        >
          {formatMessage({ id: "app.work.batch.send" }, { count })}
        </Button>
      </div>
    </section>
  );
}
