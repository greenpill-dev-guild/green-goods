import { Button } from "@green-goods/shared/components/Button";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useState } from "react";
import { useIntl } from "react-intl";
import type { QueueBookingAct } from "./voucherQueue";

export interface VoucherRowActProps {
  booking: VoucherBooking;
  act: QueueBookingAct;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  /** Open the act's dialog over the queue. */
  onOpen: (kind: "report" | "propose") => void;
  /** Reports its own failure (`VoucherConsoleActs.retryTransfer`). */
  onRetry: (booking: VoucherBooking) => Promise<void>;
}

/**
 * A booking's one act in its Review Promises row (`SIssuer`), where Approve… and Accept… sit on
 * the asks' rows: Report Visit… and Propose Return… open their dialogs; Retry Transfer sends the
 * same transfer again in one tap, since anyone may and it can't be sent twice. A failed retry
 * says so in the shared toast and leaves the row as it was.
 */
export function VoucherRowAct({ booking, act, disabled, onOpen, onRetry }: VoucherRowActProps) {
  const { formatMessage } = useIntl();
  const [retrying, setRetrying] = useState(false);
  // The act reports a failure through the shared toast and resolves; the row stays as it was.
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry(booking);
    } finally {
      setRetrying(false);
    }
  };
  const label =
    act === "retry"
      ? booking.issuer.execution === "safe-file"
        ? formatMessage({
            id: "hub.garden.pool.voucher.live.downloadRetry",
            defaultMessage: "Download Retry File",
          })
        : formatMessage({
            id: "hub.garden.pool.voucher.act.retry",
            defaultMessage: "Retry Transfer",
          })
      : act === "report"
        ? formatMessage({
            id: "hub.garden.pool.voucher.act.report",
            defaultMessage: "Report Visit…",
          })
        : formatMessage({
            id: "hub.garden.pool.voucher.act.propose",
            defaultMessage: "Propose Return…",
          });
  return (
    <Button
      type="button"
      emphasis="primary"
      size="compact"
      loading={retrying}
      disabled={disabled || retrying}
      onClick={act === "retry" ? () => void retry() : () => onOpen(act)}
    >
      {label}
    </Button>
  );
}
