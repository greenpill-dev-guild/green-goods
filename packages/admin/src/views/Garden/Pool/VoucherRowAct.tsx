import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { RiArrowGoBackLine, RiFileEditLine, RiRefreshLine } from "@remixicon/react";
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
  /**
   * `queue` (the default): the act a Review Promises row waits on, a filled compact button.
   * `row`: an optional act in an offer's row in Offers and Asks, outlined like the list's other
   * row acts, and its icon alone below 480px of row (DL-120), so the title keeps its room.
   */
  variant?: "queue" | "row";
}

/**
 * A booking's one act (`SIssuer`): in its Review Promises row, where Approve… and Accept and Start… sit on
 * the asks' rows, or, for an optional return, in its offer's row. Report Visit… and Propose
 * Return… open their dialogs; Retry Transfer sends the same transfer again in one tap, since
 * anyone may and it can't be sent twice. A failed retry says so in the shared toast and leaves
 * the row as it was.
 */
export function VoucherRowAct({
  booking,
  act,
  disabled,
  onOpen,
  onRetry,
  variant = "queue",
}: VoucherRowActProps) {
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
  const onClick = act === "retry" ? () => void retry() : () => onOpen(act);
  if (variant === "row") {
    const glyph =
      act === "retry" ? (
        <RiRefreshLine aria-hidden="true" />
      ) : act === "report" ? (
        <RiFileEditLine aria-hidden="true" />
      ) : (
        <RiArrowGoBackLine aria-hidden="true" />
      );
    return (
      <>
        <IconButton
          emphasis="secondary"
          size="sm"
          className="@[480px]:hidden"
          aria-label={label}
          title={label}
          loading={retrying}
          disabled={disabled || retrying}
          onClick={onClick}
          icon={glyph}
        />
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          className="hidden @[480px]:inline-flex"
          loading={retrying}
          disabled={disabled || retrying}
          onClick={onClick}
        >
          {label}
        </Button>
      </>
    );
  }
  return (
    <Button
      type="button"
      emphasis="primary"
      size="compact"
      loading={retrying}
      disabled={disabled || retrying}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
