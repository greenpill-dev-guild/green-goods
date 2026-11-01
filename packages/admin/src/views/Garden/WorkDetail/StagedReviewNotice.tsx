import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import type { StagedReview } from "@green-goods/shared/hooks/work/useWorkApproval";
import { useIntl } from "react-intl";

interface StagedReviewNoticeProps {
  review: StagedReview;
  /** A send is in flight, and it has already taken this review. */
  disabled?: boolean;
  onRemove: () => void;
}

/**
 * The review form while this work's decision waits in the steward's batch: what was decided, why
 * the last send could not take it if it couldn't, and the way back to deciding again.
 */
export function StagedReviewNotice({
  review,
  disabled = false,
  onRemove,
}: StagedReviewNoticeProps) {
  const { formatMessage } = useIntl();
  const { draft, refusal, notBatchable } = review;
  const problem =
    refusal ?? (notBatchable ? formatMessage({ id: "app.work.batch.notBatchable" }) : null);

  return (
    <div className="mt-4 space-y-3" data-slot="staged-review">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="type-label-sm text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 type-body font-medium text-text-strong">
          {formatMessage({
            id: draft.approved ? "app.work.batch.chip.approve" : "app.work.batch.chip.reject",
          })}
        </p>
      </div>
      {draft.feedback ? (
        <div className="rounded-md bg-bg-weak p-3">
          <p className="type-label-sm text-text-soft">
            {formatMessage({ id: "app.work.detail.reviewFeedback" })}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words type-body text-text-strong">
            {draft.feedback}
          </p>
        </div>
      ) : null}
      {problem ? (
        <Alert variant="warning">{problem}</Alert>
      ) : (
        <p className="type-meta text-text-soft">
          {formatMessage({ id: "app.work.batch.staged.hint" })}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          data-action="remove-from-batch"
        >
          {formatMessage({ id: "app.work.batch.remove" })}
        </Button>
      </div>
    </div>
  );
}
