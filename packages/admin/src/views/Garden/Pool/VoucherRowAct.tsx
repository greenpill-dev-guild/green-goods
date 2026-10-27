import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { RiArrowGoBackLine, RiFileEditLine, RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface VoucherRowActProps {
  booking: VoucherBooking;
  act: "report" | "propose" | "retry";
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  /** Open the act's dialog over the list. */
  onOpen: (kind: "report" | "propose") => void;
  /** Reports its own failure (`VoucherConsoleActs.retryTransfer`). */
  onRetry: (booking: VoucherBooking) => Promise<void>;
}

/**
 * A booking's one act in its offer row's right slot (`SIssuer`): Report Visit…
 * and Propose Return… open their dialogs, outlined like the list's other row
 * acts. Retry Transfer sends the same transfer again in one tap, since anyone
 * may and it can't be sent twice; a failed retry says so in the shared toast
 * and leaves the row as it was.
 * Below 480px of row each act is its icon, as Expire Now… is (DL-120), so the
 * title, pill and line keep their room.
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
  const view =
    act === "retry"
      ? {
          label:
            booking.issuer.execution === "safe-file"
              ? formatMessage({
                  id: "cockpit.garden.pool.voucher.live.downloadRetry",
                  defaultMessage: "Download Retry File",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.voucher.act.retry",
                  defaultMessage: "Retry Transfer",
                }),
          glyph: <RiRefreshLine aria-hidden="true" />,
          emphasis: "primary" as const,
          onClick: () => void retry(),
        }
      : {
          label:
            act === "report"
              ? formatMessage({
                  id: "cockpit.garden.pool.voucher.act.report",
                  defaultMessage: "Report Visit…",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.voucher.act.propose",
                  defaultMessage: "Propose Return…",
                }),
          glyph:
            act === "report" ? (
              <RiFileEditLine aria-hidden="true" />
            ) : (
              <RiArrowGoBackLine aria-hidden="true" />
            ),
          emphasis: "secondary" as const,
          onClick: () => onOpen(act),
        };
  return (
    <>
      <IconButton
        emphasis={view.emphasis}
        size="sm"
        className="@[480px]:hidden"
        aria-label={view.label}
        title={view.label}
        loading={retrying}
        disabled={disabled || retrying}
        onClick={view.onClick}
        icon={view.glyph}
      />
      <Button
        type="button"
        emphasis={view.emphasis}
        size="compact"
        className="hidden @[480px]:inline-flex"
        loading={retrying}
        disabled={disabled || retrying}
        onClick={view.onClick}
      >
        {view.label}
      </Button>
    </>
  );
}
