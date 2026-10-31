import type { ServiceOfferLine } from "@green-goods/shared/commitment-pooling";
import type { CommitmentRowProps } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";

/** Why no booking starts the usual way: the reader has to act on it, so it reads as a reason. */
const REASON = {
  paused: "app.commitments.row.service.paused",
  delisted: "app.commitments.row.service.delisted",
  setup: "app.commitments.row.service.setup",
} as const;

/**
 * A service offer's detail line (PRD-1299, surface 5): what booking takes first, in whole
 * vouchers as the wallet writes them ("9", "0.99"), then who promises delivery. An issuer that
 * paused bookings, or whose vouchers left the exchange pool, says so in the booking's place.
 * Only the lists that read services import it, so Home's own sections and startup never carry it.
 */
export function serviceOfferDetail(
  intl: Pick<IntlShape, "formatMessage" | "locale">,
  line: ServiceOfferLine | undefined
): CommitmentRowProps["service"] {
  if (!line) return null;
  const { booking } = line;
  return {
    booking:
      booking.kind === "hold"
        ? intl.formatMessage(
            { id: "app.commitments.row.service.hold" },
            { count: formatTokenAmount(booking.held, booking.decimals, 2, intl.locale, true) }
          )
        : booking.kind === "exchange"
          ? intl.formatMessage({ id: "app.commitments.row.service.exchange" })
          : {
              text: intl.formatMessage({ id: REASON[booking.kind] }),
              tone: booking.kind === "setup" ? "soft" : "error",
            },
    promisedBy: line.promisedBy,
  };
}
