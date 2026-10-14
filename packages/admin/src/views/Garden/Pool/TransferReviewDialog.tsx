import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { formatGdollar } from "./poolFundingPresentation";

export type TransferAct = "dispatch" | "retry" | "requeue";

export interface TransferReviewDialogProps {
  /** The act under review and the disbursement it sends, or null when closed. */
  review: { act: TransferAct; disbursementId: bigint } | null;
  /** What the disbursement carries, in base units. */
  amount: bigint | null;
  /** Who receives it, as the steward knows them: a garden's name, or its account. */
  recipient: string;
  /** The pool and record this disbursement belongs to, when opened from an inspector. */
  target?: ReactNode;
  tone: "garden" | "hub" | "community";
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  /** A failed send; the dialog closes unless the caller keeps it. */
  onError?: () => void;
}

/**
 * The review before a disbursement goes out (hub decision 30): what it is, how
 * much, to whom, and which act sends it, in one transaction. A commitment's
 * payout disbursements and the protocol's transfers to gardens are the same
 * acts on the same module, so they share this one review.
 */
export function TransferReviewDialog({
  review,
  amount,
  recipient,
  target,
  tone,
  isLoading,
  onClose,
  onConfirm,
  onError,
}: TransferReviewDialogProps) {
  const { formatMessage, locale } = useIntl();
  const id = review ? `#${review.disbursementId.toString()}` : "";
  const body = () => {
    if (!review) return undefined;
    if (review.act === "dispatch") {
      return formatMessage(
        {
          id: "cockpit.garden.pool.settlement.review.dispatchBody",
          defaultMessage:
            "Dispatch disbursement {id} for {amount} to {recipient} over CCIP to Celo.",
        },
        { id, amount: formatGdollar(amount, locale), recipient }
      );
    }
    if (review.act === "retry") {
      return formatMessage(
        {
          id: "cockpit.garden.pool.settlement.review.retryBody",
          defaultMessage: "Resend the same command for disbursement {id}: {amount} to {recipient}.",
        },
        { id, amount: formatGdollar(amount, locale), recipient }
      );
    }
    return formatMessage(
      {
        id: "cockpit.garden.pool.settlement.review.requeueBody",
        defaultMessage:
          "Start a new attempt for failed disbursement {id}: {amount} to {recipient}.",
      },
      { id, amount: formatGdollar(amount, locale), recipient }
    );
  };

  return (
    <AdminConfirmDialog
      isOpen={review !== null}
      onClose={onClose}
      tone={tone}
      variant="warning"
      title={formatMessage({
        id: "cockpit.garden.pool.settlement.review.title",
        defaultMessage: "Review Before Sending",
      })}
      target={target}
      description={body()}
      confirmLabel={formatMessage({
        id: "cockpit.garden.pool.settlement.review.confirm",
        defaultMessage: "Send Transaction",
      })}
      cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
      isLoading={isLoading}
      onConfirm={async () => {
        await onConfirm();
        onClose();
      }}
      onError={onError ?? onClose}
    />
  );
}
