import type { VoucherAcceptAndStartOutcome } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { VOUCHER_START_FALLBACK_SECONDS } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { IntlShape } from "react-intl";

/**
 * What an Accept and Start says when its start didn't fully go (DL-193). The booking stays
 * accepted either way, and the member's own Start the Booking covers a start that didn't go.
 */
export function acceptAndStartNotice(
  outcome: Exclude<VoucherAcceptAndStartOutcome, "started">,
  intl: IntlShape
): { title: string; message: string } {
  const minutes = VOUCHER_START_FALLBACK_SECONDS / 60;
  switch (outcome) {
    case "acceptanceWaiting":
      return {
        title: intl.formatMessage({
          id: "hub.garden.pool.voucher.acceptStart.safeTitle",
          defaultMessage: "The acceptance waits on your Safe’s signers",
        }),
        message: intl.formatMessage(
          {
            id: "hub.garden.pool.voucher.acceptStart.safeBody",
            defaultMessage:
              "Nothing was started. Once they approve it, the member can start the booking from the app after {minutes} minutes.",
          },
          { minutes }
        ),
      };
    // The wallet answered with no receipt (PRD-1574): the acceptance itself may still land.
    case "acceptanceConfirming":
      return {
        title: intl.formatMessage({
          id: "hub.garden.pool.voucher.acceptStart.acceptingTitle",
          defaultMessage: "The acceptance is still being confirmed",
        }),
        message: intl.formatMessage(
          {
            id: "hub.garden.pool.voucher.acceptStart.acceptingBody",
            defaultMessage:
              "Nothing was started. If it lands, the member can start the booking from the app {minutes} minutes after you accepted.",
          },
          { minutes }
        ),
      };
    case "unconfirmed":
      return {
        title: intl.formatMessage({
          id: "hub.garden.pool.voucher.acceptStart.confirmingTitle",
          defaultMessage: "Accepted. The start is still being confirmed",
        }),
        message: intl.formatMessage({
          id: "hub.garden.pool.voucher.acceptStart.confirmingBody",
          defaultMessage:
            "It can still land. If it doesn’t, the member can start the booking from the app.",
        }),
      };
    case "notSent":
      return {
        title: intl.formatMessage({
          id: "hub.garden.pool.voucher.acceptStart.notSentTitle",
          defaultMessage: "Accepted. The start wasn’t sent",
        }),
        message: intl.formatMessage(
          {
            id: "hub.garden.pool.voucher.acceptStart.notSentBody",
            defaultMessage:
              "The booking stays accepted. The member can start it from the app {minutes} minutes after you accepted.",
          },
          { minutes }
        ),
      };
  }
}
