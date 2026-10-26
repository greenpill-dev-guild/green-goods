/**
 * A service offer on a garden's list of promises (PRD-1299 surface 5): what booking it takes
 * first, and who promises delivery, from the promise's service terms and the reader's vouchers.
 * Whatever the reads cannot establish leaves the row an ordinary offer.
 */

import { describe, expect, it } from "vitest";

import { serviceOfferLine } from "../modules/commitment-pooling/service-offer-line";
import type { ServiceAccessSnapshot } from "../modules/commitment-pooling/service-access-types";
import type {
  VoucherIssuer,
  VoucherWalletSnapshot,
} from "../modules/commitment-pooling/service-access-wallet-types";
import type { Address } from "../types/domain";

const TECH_AND_SUN = "0x5555555555555555555555555555555555555555" as Address;
const TOKEN = "0x6666666666666666666666666666666666666666" as Address;
const MAYA = "0x7777777777777777777777777777777777777777" as Address;
const MAYA_TOKEN = "0x8888888888888888888888888888888888888888" as Address;
const ONE = 1_000_000n;

const issuer = (over: Partial<VoucherIssuer> = {}): VoucherIssuer => ({
  account: TECH_AND_SUN,
  kind: "collective",
  name: "Tech and Sun",
  gender: "feminine",
  asset: { chainId: 100, token: TOKEN, symbol: "TAS", decimals: 6 },
  garden: TECH_AND_SUN,
  ...over,
});

/** A hub day booked with Tech and Sun vouchers: one booking takes `units` of them. */
const hubDay = (units: bigint, decimals: number | null = 6) =>
  ({
    mode: "voucher",
    offer: {
      voucher: {
        asset: { chainId: 100, token: TOKEN, symbol: "TAS", decimals },
        issuer: TECH_AND_SUN,
        units,
      },
    },
  }) as unknown as Pick<ServiceAccessSnapshot, "mode" | "offer">;

const wallet = (
  held: bigint,
  over: Partial<VoucherWalletSnapshot> = {}
): Pick<VoucherWalletSnapshot, "evidence" | "issuers" | "holdings"> => ({
  evidence: "onchain",
  issuers: [issuer()],
  holdings: [{ issuer: issuer(), available: held }],
  ...over,
});

describe("serviceOfferLine", () => {
  it("says the reader holds enough of the issuer's vouchers, and names the issuer", () => {
    expect(serviceOfferLine(hubDay(ONE), wallet(9n * ONE))).toEqual({
      promisedBy: "Tech and Sun",
      booking: { kind: "hold", held: 9n * ONE, decimals: 6 },
    });
  });

  it("says to exchange first when the reader holds fewer than a booking takes, or none", () => {
    expect(serviceOfferLine(hubDay(2n * ONE), wallet(ONE))?.booking).toEqual({
      kind: "exchange",
    });
    expect(serviceOfferLine(hubDay(ONE), wallet(0n, { holdings: [] }))).toEqual({
      promisedBy: "Tech and Sun",
      booking: { kind: "exchange" },
    });
  });

  // A member's own service is the pilot's second slice.
  it("leaves a member issuer's offer an ordinary row", () => {
    const member = issuer({
      account: MAYA,
      kind: "individual",
      name: "Maya",
      asset: { chainId: 100, token: MAYA_TOKEN, symbol: "MAYA", decimals: 6 },
    });
    const snapshot = {
      mode: "voucher",
      offer: { voucher: { asset: member.asset, issuer: MAYA, units: ONE } },
    } as unknown as Pick<ServiceAccessSnapshot, "mode" | "offer">;

    expect(serviceOfferLine(snapshot, wallet(ONE, { issuers: [member], holdings: [] }))).toBeNull();
  });

  // Until the deployment is adopted, the live reads answer "unavailable": every row stays an
  // ordinary offer, never an error.
  it.each([
    ["the service read is unavailable", { mode: "unavailable", offer: null }, wallet(ONE)],
    ["the wallet read is unavailable", hubDay(ONE), wallet(ONE, { evidence: "unavailable" })],
    ["the wallet names no such issuer", hubDay(ONE), wallet(ONE, { issuers: [] })],
    ["the token's precision is unknown", hubDay(ONE, null), wallet(ONE, { issuers: [] })],
    ["nothing has been read", undefined, undefined],
  ])("leaves the row an ordinary offer when %s", (_case, snapshot, read) => {
    expect(
      serviceOfferLine(snapshot as Pick<ServiceAccessSnapshot, "mode" | "offer">, read)
    ).toBeNull();
  });
});
