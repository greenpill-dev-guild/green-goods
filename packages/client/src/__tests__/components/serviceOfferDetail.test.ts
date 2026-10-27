/**
 * A service offer's detail line on a garden's list of promises (PRD-1299 surface 5): what
 * booking takes first, then who promises delivery, a garden or a member.
 */
// TEST-QUALITY: allow-small-test-file - GardenPool.test.tsx covers this mapping through the Promises tab, but it is past the 500-line limit for modified files.

import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { serviceOfferDetail } from "../../components/Features/Commitments/serviceOfferDetail";

const intl = createIntl({ locale: "en", messages: en });

describe("serviceOfferDetail", () => {
  // An issuer that paused bookings, or whose vouchers left the exchange pool, says so where the
  // booking would start, as a reason the reader acts on, and the row keeps naming who promises it.
  it("gives a paused or delisted issuer's reason in the booking's place", () => {
    expect(
      serviceOfferDetail(intl, { promisedBy: "Teo Alves", booking: { kind: "paused" } })
    ).toEqual({ booking: { text: "Bookings paused", tone: "error" }, promisedBy: "Teo Alves" });
    expect(
      serviceOfferDetail(intl, { promisedBy: "Maya Ruiz", booking: { kind: "delisted" } })
    ).toEqual({
      booking: { text: "Not in the exchange pool", tone: "error" },
      promisedBy: "Maya Ruiz",
    });
  });
});
