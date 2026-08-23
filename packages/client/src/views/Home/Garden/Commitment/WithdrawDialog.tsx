import { Alert, DialogShell } from "@green-goods/shared";
import { MAX_REASON } from "@green-goods/shared/commitment-pooling";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "OFFER" | "REQUEST";
  isPending: boolean;
  /**
   * The last attempt could not pin the reason, so nothing was sent. The words
   * stay on screen and the same button tries the pin again.
   */
  pinFailed?: boolean;
  onConfirm: (reason: string) => void;
}

/**
 * Taking back something nobody has relied on yet.
 *
 * The reason is required because the contract stores one and the timeline shows
 * it. What the dialog must not soften: this leaves the pool, and asking again
 * later is a fresh commitment rather than a retry of this one.
 *
 * The reason leaves here as words. Pinning it is the shared hook's job, so the
 * dialog never holds a CID and can never send the text in a CID's place.
 */
export function WithdrawDialog({
  open,
  onOpenChange,
  direction,
  isPending,
  pinFailed = false,
  onConfirm,
}: WithdrawDialogProps) {
  const { formatMessage } = useIntl();
  const [reason, setReason] = useState("");
  const isRequest = direction === "REQUEST";

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({
        id: isRequest
          ? "app.commitment.withdraw.titleRequest"
          : "app.commitment.withdraw.titleOffer",
      })}
      description={formatMessage({
        id: isRequest ? "app.commitment.withdraw.bodyRequest" : "app.commitment.withdraw.bodyOffer",
      })}
      size="md"
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="withdraw-reason">
          {formatMessage({ id: "app.commitment.withdraw.reasonLabel" })}
        </label>
        <textarea
          id="withdraw-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          // Matches the pinned document's limit, so the words that are stored
          // are the words that were on screen.
          maxLength={MAX_REASON}
          className="w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
          placeholder={formatMessage({ id: "app.commitment.withdraw.reasonPlaceholder" })}
        />
        {pinFailed ? (
          <Alert variant="error" className="p-3">
            {formatMessage({ id: "app.commitment.withdraw.reasonUnsaved" })}
          </Alert>
        ) : null}
        <button
          type="button"
          disabled={reason.trim().length === 0 || isPending}
          aria-busy={isPending}
          onClick={() => onConfirm(reason.trim())}
          className="w-full rounded-[var(--radius-lg)] border border-error-base px-4 py-3 text-sm font-medium text-error-base tap-target-lg disabled:opacity-60"
        >
          {formatMessage({
            id: pinFailed
              ? "app.commitment.withdraw.retry"
              : isRequest
                ? "app.commitment.withdraw.confirmRequest"
                : "app.commitment.withdraw.confirmOffer",
          })}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
          className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
        >
          {formatMessage({ id: "app.commitment.withdraw.keep" })}
        </button>
      </div>
    </DialogShell>
  );
}
