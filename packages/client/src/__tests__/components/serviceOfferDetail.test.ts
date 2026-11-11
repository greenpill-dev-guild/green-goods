/**
 * A service offer's detail line on a garden's list of promises (PRD-1299 surface 5): what a
 * booking takes in the issuer's vouchers, then what booking takes first, a garden's or a member's.
 */
// TEST-QUALITY: allow-small-test-file - GardenPool.test.tsx covers this mapping through the Promises tab, but it is past the 500-line limit for modified files.

import type { ServiceOfferLine } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { serviceOfferDetail } from "../../components/Features/Commitments/serviceOfferDetail";

const intl = createIntl({ locale: "en", messages: en });
const ONE = 1_000_000n;
const line = (
  promisedBy: string,
  booking: ServiceOfferLine["booking"],
  over: Partial<ServiceOfferLine> = {}
): ServiceOfferLine => ({
  promisedBy,
  gender: null,
  takes: { units: ONE, decimals: 6 },
  booking,
  ...over,
});

describe("serviceOfferDetail", () => {
  // The price names the issuer's vouchers, so the row says who promises delivery through it, and
  // Portuguese agrees the phrase with the issuer's gender as the wallet does.
  it("names what a booking takes in the issuer's vouchers, then what booking takes first", () => {
    const claude = line(
      "Green Goods",
      { kind: "hold", held: 2n * ONE, decimals: 6 },
      {
        gender: "masculine",
        takes: { units: 10n * ONE, decimals: 6 },
      }
    );
    expect(serviceOfferDetail(intl, claude)).toEqual({
      takes: "Takes 10 Green Goods vouchers",
      booking: "You hold 2",
      promisedBy: "Green Goods",
    });
    expect(serviceOfferDetail(intl, line("Teo Alves", { kind: "exchange" }))).toEqual({
      takes: "Takes 1 Teo Alves voucher",
      booking: "Exchange first",
      promisedBy: "Teo Alves",
    });
    expect(serviceOfferDetail(createIntl({ locale: "es", messages: es }), claude)?.takes).toBe(
      "Requiere 10 vales de Green Goods"
    );
    expect(serviceOfferDetail(createIntl({ locale: "pt", messages: pt }), claude)?.takes).toBe(
      "Exige 10 vales do Green Goods"
    );
  });

  // An issuer that paused bookings, or whose vouchers left the exchange pool, says so where the
  // booking would start, as a reason the reader acts on, under the price.
  it("gives a paused or delisted issuer's reason in the booking's place", () => {
    expect(serviceOfferDetail(intl, line("Teo Alves", { kind: "paused" }))).toEqual({
      takes: "Takes 1 Teo Alves voucher",
      booking: { text: "Bookings paused", tone: "error" },
      promisedBy: "Teo Alves",
    });
    expect(serviceOfferDetail(intl, line("Maya Ruiz", { kind: "delisted" }))).toEqual({
      takes: "Takes 1 Maya Ruiz voucher",
      booking: { text: "Not in the exchange pool", tone: "error" },
      promisedBy: "Maya Ruiz",
    });
  });
});
