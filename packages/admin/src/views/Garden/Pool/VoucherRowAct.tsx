import { Button } from "@green-goods/shared/components/Button";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface VoucherRowActProps {
  booking: VoucherBooking;
  act: "report" | "propose" | "retry";
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  /** Open the act's dialog over the list. */
  onOpen: (kind: "report" | "propose") => void;
  onRetry: (booking: VoucherBooking) => Promise<void>;
}

/**
 * A booking's one act in its offer row's right slot (`SIssuer`): Report Visit…
 * and Propose Return… open their dialogs, outlined like the list's other row
 * acts. Retry Transfer sends the same transfer again in one tap, since anyone
 * may and it can't be sent twice; a failed retry leaves the row as it was.
 */
export function VoucherRowAct({ booking, act, disabled, onOpen, onRetry }: VoucherRowActProps) {
  const { formatMessage } = useIntl();
  const [retrying, setRetrying] = useState(false);
  if (act === "retry") {
    return (
      <Button
        type="button"
        emphasis="primary"
        size="compact"
        loading={retrying}
        disabled={disabled || retrying}
        onClick={async () => {
          setRetrying(true);
          try {
            await onRetry(booking);
          } catch (error) {
            logger.error("Voucher transfer retry failed", {
              error,
              commitmentId: booking.commitmentId.toString(),
            });
          } finally {
            setRetrying(false);
          }
        }}
      >
        {formatMessage({
          id: "cockpit.garden.pool.voucher.act.retry",
          defaultMessage: "Retry Transfer",
        })}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      emphasis="secondary"
      size="compact"
      disabled={disabled}
      onClick={() => onOpen(act)}
    >
      {act === "report"
        ? formatMessage({
            id: "cockpit.garden.pool.voucher.act.report",
            defaultMessage: "Report Visit…",
          })
        : formatMessage({
            id: "cockpit.garden.pool.voucher.act.propose",
            defaultMessage: "Propose Return…",
          })}
    </Button>
  );
}
